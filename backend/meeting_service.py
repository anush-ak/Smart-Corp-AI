import os
import re
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import google.generativeai as genai

from backend.config import GEMINI_API_KEY

# Configure Gemini API if key is present
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY, transport="rest")
    except Exception:
        genai.configure(api_key=GEMINI_API_KEY)


class DraftTaskItem(BaseModel):
    title: str = Field(description="Clear, actionable title of the task")
    assignee: str = Field(default="Unassigned", description="Name of the team member assigned or 'Unassigned'")
    priority: str = Field(default="Medium", description="Priority level: Low, Medium, High, or Urgent")
    due_date: Optional[str] = Field(default=None, description="Due date in YYYY-MM-DD format, or null if uncertain")
    est_hours: float = Field(default=4.0, description="Estimated work hours required for completion")


class MeetingExtractionResponse(BaseModel):
    tasks: List[DraftTaskItem]


def fallback_extract_tasks(notes: str, team_members: List[str]) -> List[DraftTaskItem]:
    """
    Deterministic fallback parser when Gemini API is unavailable or times out.
    Scans notes line-by-line for bullet points, action items, assignees, and deadlines.
    """
    extracted: List[DraftTaskItem] = []
    lines = [line.strip() for line in notes.splitlines() if line.strip()]
    today = datetime.now(timezone.utc).date()

    for line in lines:
        # Check if line looks like an action item, bullet, or task
        is_bullet = line.startswith(("-", "*", "•", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9."))
        lower_line = line.lower()
        has_action_kw = any(kw in lower_line for kw in ["todo", "action", "assign", "deliver", "deploy", "review", "draft", "prepare", "build", "fix", "implement", "update"])

        if not (is_bullet or has_action_kw):
            continue

        clean_text = re.sub(r"^[-*•\d.]+\s*", "", line).strip()
        if len(clean_text) < 5:
            continue

        # Match assignee
        matched_assignee = "Unassigned"
        for member in team_members:
            # Check full name or first name
            first_name = member.split()[0]
            if re.search(r"\b" + re.escape(member) + r"\b", clean_text, re.IGNORECASE) or \
               re.search(r"\b" + re.escape(first_name) + r"\b", clean_text, re.IGNORECASE):
                matched_assignee = member
                break

        # Match priority
        priority = "Medium"
        if any(w in lower_line for w in ["urgent", "critical", "asap", "blocker"]):
            priority = "Urgent"
        elif any(w in lower_line for w in ["high", "priority", "important", "major"]):
            priority = "High"
        elif any(w in lower_line for w in ["low", "minor", "optional", "backlog"]):
            priority = "Low"

        # Match due date
        due_date_str = None
        date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", clean_text)
        if date_match:
            due_date_str = date_match.group(1)
        elif "by friday" in lower_line or "end of week" in lower_line:
            days_until_friday = (4 - today.weekday()) % 7
            if days_until_friday == 0:
                days_until_friday = 7
            due_date_str = (today + timedelta(days=days_until_friday)).isoformat()
        elif "by next week" in lower_line or "next monday" in lower_line:
            days_until_monday = (7 - today.weekday()) % 7
            if days_until_monday == 0:
                days_until_monday = 7
            due_date_str = (today + timedelta(days=days_until_monday)).isoformat()
        elif "tomorrow" in lower_line:
            due_date_str = (today + timedelta(days=1)).isoformat()

        # Estimate hours
        hours_match = re.search(r"(\d+(\.\d+)?)\s*(hours|hrs|h)\b", lower_line)
        if hours_match:
            try:
                est_hours = float(hours_match.group(1))
            except ValueError:
                est_hours = 4.0
        else:
            if priority == "Urgent":
                est_hours = 6.0
            elif priority == "High":
                est_hours = 8.0
            else:
                est_hours = 4.0

        # Remove labels like "Action Item:", "TODO:" from title
        title = re.sub(r"^(Action\s+Item\s*:|TODO\s*:|Task\s*:)\s*", "", clean_text, flags=re.IGNORECASE).strip()

        try:
            task = DraftTaskItem(
                title=title,
                assignee=matched_assignee,
                priority=priority,
                due_date=due_date_str,
                est_hours=round(est_hours, 1),
            )
            extracted.append(task)
        except Exception:
            pass

    return extracted


def extract_tasks_from_notes(notes: str, team_members: List[str]) -> List[DraftTaskItem]:
    """
    Extract actionable tasks from raw meeting transcript/notes.
    Uses gemini-2.5-flash with response_mime_type="application/json".
    Validates every extracted item with Pydantic v2 schema (DraftTaskItem).
    Falls back gracefully to deterministic extractor if Gemini is unavailable.
    """
    clean_notes = notes.strip()
    if not clean_notes:
        return []

    team_members_str = ", ".join(f'"{m}"' for m in team_members) if team_members else '"Unassigned"'
    today_str = datetime.now(timezone.utc).date().isoformat()

    prompt = f"""You are an executive operational AI for SmartCorp.
Your task is to extract all actionable tasks and deliverables from the meeting notes below.

Available Team Members: [{team_members_str}]
Today's Date: {today_str}

Rules:
1. Extract every concrete action item, task, or deliverable.
2. Assignee matching:
   - Match the assignee to EXACTLY one of the provided Available Team Members: [{team_members_str}].
   - If a person is mentioned by first name, match them to the corresponding full name in the team members list.
   - If the assignee is unspecified, ambiguous, or not in the team list, set "assignee": "Unassigned".
3. Priority:
   - Choose one of: "Low", "Medium", "High", "Urgent".
4. Due date:
   - If a date or timeframe is mentioned (e.g. "by Friday", "by next week", "Nov 30"), compute and format it as ISO "YYYY-MM-DD" based on Today's Date ({today_str}).
   - If no deadline is stated or it is uncertain, set "due_date": null.
5. Estimated Hours:
   - Estimate reasonable engineering/ops work hours ("est_hours", e.g. 2.0, 4.0, 8.0, 12.0) based on scope.
6. Format:
   - You MUST output valid JSON matching this schema:
   {{
     "tasks": [
       {{
         "title": "string",
         "assignee": "string",
         "priority": "Low" | "Medium" | "High" | "Urgent",
         "due_date": "YYYY-MM-DD" | null,
         "est_hours": number
       }}
     ]
   }}

Meeting Notes:
\"\"\"
{clean_notes}
\"\"\"
"""

    if GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    max_output_tokens=2048,
                ),
                request_options={"timeout": 12},
            )
            if response and response.text:
                data = json.loads(response.text)
                raw_tasks = data.get("tasks", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                validated_tasks: List[DraftTaskItem] = []
                for item in raw_tasks:
                    try:
                        # Normalize assignee: ensure it matches a known member or "Unassigned"
                        raw_assignee = item.get("assignee", "Unassigned")
                        matched_assignee = "Unassigned"
                        for m in team_members:
                            if m.lower() == raw_assignee.lower() or m.split()[0].lower() == raw_assignee.lower():
                                matched_assignee = m
                                break

                        # Priority normalization
                        raw_priority = item.get("priority", "Medium").capitalize()
                        if raw_priority not in ["Low", "Medium", "High", "Urgent"]:
                            raw_priority = "Medium"

                        # Est hours normalization
                        raw_hours = float(item.get("est_hours", 4.0) or 4.0)
                        if raw_hours <= 0:
                            raw_hours = 2.0

                        draft = DraftTaskItem(
                            title=item.get("title", "Untitled Task").strip(),
                            assignee=matched_assignee,
                            priority=raw_priority,
                            due_date=item.get("due_date"),
                            est_hours=round(raw_hours, 1),
                        )
                        validated_tasks.append(draft)
                    except Exception as val_err:
                        print(f"Skipping invalid task item: {val_err}")

                if validated_tasks:
                    return validated_tasks
        except Exception as e:
            print(f"Gemini meeting extraction warning: {e}. Using deterministic fallback.")

    # Fallback to deterministic extraction
    return fallback_extract_tasks(clean_notes, team_members)

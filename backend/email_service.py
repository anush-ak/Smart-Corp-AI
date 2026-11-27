import os
import json
from typing import Optional, Dict, Any
import google.generativeai as genai

from backend.config import GEMINI_API_KEY


VALID_MESSAGE_TYPES = {
    "Professional email",
    "Internal company message",
    "Meeting follow-up",
    "Leave request",
    "Project update",
    "Announcement",
}

VALID_TONES = {
    "Formal",
    "Friendly",
    "Concise",
    "Persuasive",
    "Professional",
}

VALID_ACTIONS = {"generate", "rewrite", "shorten", "improve", "regenerate"}


def _fallback_compose_message(
    description: str,
    message_type: str,
    tone: str,
    recipient: Optional[str],
    subject: Optional[str],
    important_points: Optional[str],
    action: str,
    current_draft: Optional[str],
    sender_name: str,
    org_name: str,
) -> Dict[str, str]:
    """Deterministic template composer when Gemini API is unavailable or rate-limited."""
    rec_name = (recipient or "").strip() or "Team"
    subj = (subject or "").strip()

    if not subj:
        type_subjects = {
            "Professional email": f"Follow-up: {description[:52].strip()}",
            "Internal company message": f"Quick Update: {description[:48].strip()}",
            "Meeting follow-up": "Meeting Follow-Up & Next Steps",
            "Leave request": "Leave Request for Upcoming Dates",
            "Project update": f"Project Status Update — {org_name}",
            "Announcement": f"Team Announcement — {org_name}",
        }
        subj = type_subjects.get(message_type, "Communication Update")

    if action == "shorten" and current_draft:
        lines = [ln.strip() for ln in current_draft.splitlines() if ln.strip()]
        condensed = "\n\n".join(lines[:4])
        return {"subject": subj, "body": condensed}

    greeting = {
        "Formal": f"Dear {rec_name},",
        "Friendly": f"Hi {rec_name},",
        "Concise": f"Hi {rec_name},",
        "Persuasive": f"Hello {rec_name},",
        "Professional": f"Hi {rec_name},",
    }.get(tone, f"Hi {rec_name},")

    closing = {
        "Formal": f"Sincerely,\n{sender_name}\n{org_name}",
        "Friendly": f"Best,\n{sender_name}",
        "Concise": f"Thanks,\n{sender_name}",
        "Persuasive": f"Looking forward to your thoughts,\n{sender_name}",
        "Professional": f"Best regards,\n{sender_name}",
    }.get(tone, f"Best regards,\n{sender_name}")

    points_block = ""
    if important_points and important_points.strip():
        raw_pts = [p.strip(" -•*\t") for p in important_points.splitlines() if p.strip()]
        if raw_pts:
            points_block = "\n\nKey Points:\n" + "\n".join(f"- {p}" for p in raw_pts)

    base_text = current_draft.strip() if (action in {"rewrite", "improve"} and current_draft and current_draft.strip()) else description.strip()

    if action == "shorten":
        body = f"{greeting}\n\n{base_text}{points_block}\n\n{closing}"
    elif message_type == "Meeting follow-up":
        body = (
            f"{greeting}\n\nThank you for your time today. Here is a summary regarding {base_text}."
            f"{points_block}\n\nPlease let me know if anything needs adjustment.\n\n{closing}"
        )
    elif message_type == "Leave request":
        body = (
            f"{greeting}\n\nI would like to submit a leave request regarding: {base_text}."
            f"{points_block}\n\nI have ensured my current deliverables are covered and will remain reachable for urgent escalations.\n\n{closing}"
        )
    elif message_type == "Project update":
        body = (
            f"{greeting}\n\nSharing a status update on {base_text}."
            f"{points_block}\n\nPlease reach out if you would like to review any milestone details.\n\n{closing}"
        )
    elif message_type == "Announcement":
        body = (
            f"{greeting}\n\nWe are pleased to share an update with the team: {base_text}."
            f"{points_block}\n\nThank you everyone for your continued collaboration.\n\n{closing}"
        )
    else:
        body = (
            f"{greeting}\n\n{base_text}"
            f"{points_block}\n\nPlease let me know if you have any questions or feedback.\n\n{closing}"
        )

    return {"subject": subj, "body": body}


def compose_ai_message(
    description: str,
    message_type: str,
    tone: str,
    recipient: Optional[str],
    subject: Optional[str],
    important_points: Optional[str],
    action: str,
    current_draft: Optional[str],
    sender_name: str,
    sender_role: str,
    org_name: str,
) -> Dict[str, str]:
    """
    Generate or refine an enterprise email/message using Gemini API,
    returning {"subject": ..., "body": ...}.
    """
    clean_desc = description.strip()
    clean_type = message_type if message_type in VALID_MESSAGE_TYPES else "Professional email"
    clean_tone = tone if tone in VALID_TONES else "Professional"
    clean_action = action if action in VALID_ACTIONS else "generate"

    action_instruction = {
        "generate": "Write a clear, ready-to-send message from scratch based on the brief.",
        "regenerate": "Write a fresh alternative version of the message with improved phrasing and structure.",
        "rewrite": "Rewrite the current draft completely for stronger clarity, flow, and alignment with the requested tone.",
        "shorten": "Significantly condense the current draft while preserving all essential facts, recipient context, and calls to action.",
        "improve": "Polish and elevate the current draft: fix awkward phrasing, tighten transitions, and make the structure executive-ready.",
    }[clean_action]

    prompt = f"""You are an executive business communications assistant for {org_name}.
Sender: {sender_name} ({sender_role})
Message Type: {clean_type}
Requested Tone: {clean_tone}
Action: {action_instruction}

Recipient: {(recipient or 'Not specified').strip()}
Preferred Subject: {(subject or 'Auto-generate an appropriate concise subject').strip()}
Communication Brief:
\"\"\"{clean_desc}\"\"\"

Important Points to Include:
\"\"\"{(important_points or 'None').strip()}\"\"\"
"""

    if current_draft and current_draft.strip() and clean_action in {"rewrite", "shorten", "improve"}:
        prompt += f"""
Current Draft to Transform:
\"\"\"{current_draft.strip()}\"\"\"
"""

    prompt += """
Rules:
1. Do not use placeholders like [Insert X] unless strictly necessary; write natural, polished business copy.
2. Match the requested Message Type and Tone accurately.
3. Return ONLY valid JSON with two string fields:
{
  "subject": "concise email/message subject line",
  "body": "complete formatted message body including greeting and sign-off"
}
"""

    active_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if active_key:
        try:
            try:
                genai.configure(api_key=active_key, transport="rest")
            except Exception:
                genai.configure(api_key=active_key)

            temp = 0.65 if clean_action == "regenerate" else 0.35
            for model_name in ("gemini-2.5-flash", "gemini-2.0-flash"):
                try:
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(
                        prompt,
                        generation_config=genai.types.GenerationConfig(
                            response_mime_type="application/json",
                            temperature=temp,
                            max_output_tokens=1200,
                        ),
                        request_options={"timeout": 12},
                    )
                    if response and response.text:
                        parsed: Any = json.loads(response.text)
                        if isinstance(parsed, dict) and parsed.get("body"):
                            return {
                                "subject": str(parsed.get("subject") or subject or clean_type).strip(),
                                "body": str(parsed.get("body")).strip(),
                            }
                except Exception as inner_err:
                    print(f"Email writer {model_name} warning: {inner_err}")
                    continue
        except Exception as e:
            print(f"Email writer Gemini warning: {e}")

    return _fallback_compose_message(
        description=clean_desc,
        message_type=clean_type,
        tone=clean_tone,
        recipient=recipient,
        subject=subject,
        important_points=important_points,
        action=clean_action,
        current_draft=current_draft,
        sender_name=sender_name,
        org_name=org_name,
    )

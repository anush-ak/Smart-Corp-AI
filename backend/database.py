import socket
import urllib.parse
import urllib.request
import json
import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import DATABASE_URL


def get_resolved_db_url(url_str: str) -> str:
    # Ensure psycopg2 driver is specified if dialect is plain postgresql://
    if url_str.startswith("postgresql://"):
        url_str = url_str.replace("postgresql://", "postgresql+psycopg2://", 1)

    parsed = urllib.parse.urlparse(url_str)
    hostname = parsed.hostname

    if hostname and hostname not in ("localhost", "127.0.0.1"):
        query_dict = urllib.parse.parse_qs(parsed.query)
        if "hostaddr" not in query_dict:
            ip = None
            candidate_ips = ["100.52.73.92", "44.218.206.133", "23.23.139.245"]
            for cand in candidate_ips:
                try:
                    sock = socket.socket()
                    sock.settimeout(2.0)
                    sock.connect((cand, 5432))
                    sock.close()
                    ip = cand
                    break
                except Exception:
                    continue

            if ip:
                # Strip channel_binding if present as pooler IP doesn't support SCRAM channel binding with hostaddr
                cleaned_query = {k: v for k, v in query_dict.items() if k != "channel_binding"}
                cleaned_query["hostaddr"] = [ip]
                new_query_str = urllib.parse.urlencode(cleaned_query, doseq=True)
                url_str = urllib.parse.urlunparse(
                    (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query_str, parsed.fragment)
                )

    return url_str


resolved_url = get_resolved_db_url(DATABASE_URL)

engine = create_engine(
    resolved_url,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that provides a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

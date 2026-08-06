from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.mongo_db]

# Collections
users = db.users                  # {email, name, pw_hash, role, resource_id, resource_code, department, created_at}
activity = db.activity            # {email, ts, type, message, meta}
notes = db.notes                  # {email, assignment_id, module_index, text, updated_at}
bookmarks = db.bookmarks          # {email, assignment_id, module_index, created_at}
notifications = db.notifications  # {email|null(broadcast), ts, kind, title, body, read_by: [emails]}
announcements = db.announcements  # {ts, author, title, body}
certificates = db.certificates    # {verify_id, email, name, program, cert_name, completed_at, signature}
submissions = db.submissions      # {email, assignment_id, program, text, github_url, file_name, ts,
                                  #  ai_review, mentor_review: {by, verdict, comment, ts}}


async def ensure_indexes():
    await users.create_index("email", unique=True)
    await activity.create_index([("email", 1), ("ts", -1)])
    await notes.create_index([("email", 1), ("assignment_id", 1), ("module_index", 1)], unique=True)
    await bookmarks.create_index([("email", 1), ("assignment_id", 1), ("module_index", 1)], unique=True)
    await notifications.create_index([("ts", -1)])
    await certificates.create_index("verify_id", unique=True)
    await submissions.create_index([("email", 1), ("assignment_id", 1)])

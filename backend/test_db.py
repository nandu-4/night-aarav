import asyncio
import asyncpg

db_url = "postgresql://postgres.zkmrmusdzjsebpmvqxzv:%40Nandini%404772t@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

async def reset_db():
    print(f"Connecting to database with asyncpg...")
    try:
        conn = await asyncpg.connect(db_url)
        with open("schema.sql", "r", encoding='utf-8') as f:
            schema_sql = f.read()
        with open("seed_data.sql", "r", encoding='utf-8') as f:
            seed_sql = f.read()

        print("Dropping public schema...")
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        
        print("Executing schema.sql...")
        await conn.execute(schema_sql)
        
        print("Executing seed_data.sql...")
        await conn.execute(seed_sql)
            
        print("Database reset successfully.")
        await conn.close()
    except Exception as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    asyncio.run(reset_db())

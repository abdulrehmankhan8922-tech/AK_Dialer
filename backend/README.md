# AK Dialer - Backend API

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Setup PostgreSQL database:
```bash
createdb ak_dialer
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Run migrations (if using Alembic):
```bash
alembic upgrade head
```

5. Start the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Asterisk Setup

### For Development (Mock Mode):
Set `USE_MOCK_DIALER=true` in `.env` - calls will be simulated.

### For Production (Real Calls):
1. Install Asterisk
2. Configure SIP trunk (PJSIP)
3. Set `USE_MOCK_DIALER=false` in `.env`
4. Configure Asterisk AMI connection settings

## Default Agent

Create a test agent in database:
```python
from app.models.agent import Agent
from app.core.security import get_password_hash

agent = Agent(
    username="8013",
    password_hash=get_password_hash("password"),
    phone_extension="8013",
    full_name="Test Agent",
    is_admin=0
)
```

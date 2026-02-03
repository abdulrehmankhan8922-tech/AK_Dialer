# AK Dialer - Full-Featured Auto-Dialer

A comprehensive auto-dialer solution built with Next.js (frontend) and FastAPI (backend), matching ViciDial functionality with modern architecture.

## Features

- ✅ **Agent Management**: Login/logout, status management, multi-agent support
- ✅ **Manual Dialing**: Agent-initiated calls
- ✅ **Automated Dialing**: Ready for progressive/predictive dialing
- ✅ **Call Controls**: Hangup, Transfer, Park, Pause, Dial Next
- ✅ **Customer Information Management**: Complete contact data entry
- ✅ **Real-time Statistics**: Inbound/Outbound calls, break time, login time
- ✅ **Campaign Management**: Multiple campaigns support
- ✅ **Call Recording**: Infrastructure ready (FreeSWITCH integration)
- ✅ **WebSocket Real-time Updates**: Live call status and stats updates
- ✅ **Admin Portal**: Agent and campaign management

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Database
- **SQLAlchemy** - ORM
- **FreeSWITCH** - SIP server (with mock option for testing)
- **WebSockets** - Real-time communication
- **JWT** - Authentication

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **WebSocket Client** - Real-time updates

## Project Structure

```
dialer-project/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/         # API endpoints
│   │   ├── models/             # Database models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Business logic
│   │   ├── websockets/         # WebSocket handlers
│   │   └── core/               # Configuration
│   ├── requirements.txt
│   └── main.py
│
└── frontend/
    ├── app/                    # Next.js pages
    ├── components/             # React components
    ├── lib/                    # Utilities & API client
    └── types/                  # TypeScript types
```

## Setup Instructions

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- FreeSWITCH (optional, mock mode available)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Setup PostgreSQL database:
```bash
createdb ak_dialer
```

5. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

6. Run database migrations (tables will be created automatically on first run):
```bash
# Tables are created automatically via SQLAlchemy
```

7. Start backend server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: http://localhost:8000
API docs: http://localhost:8000/docs

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend will be available at: http://localhost:3000

## Configuration

### Mock Mode (Default)

The dialer runs in mock mode by default for testing. Set in `.env`:
```
USE_MOCK_DIALER=true
```

### FreeSWITCH Setup (Production)

1. Install FreeSWITCH:
```bash
# Ubuntu/Debian
sudo apt-get install freeswitch

# Or compile from source
```

2. Configure FreeSWITCH:
- Edit `/etc/freeswitch/autoload_configs/event_socket.conf.xml`
- Set password: `ClueCon` (or change in .env)
- Enable mod_event_socket

3. Update `.env`:
```
USE_MOCK_DIALER=false
FREESWITCH_HOST=localhost
FREESWITCH_PORT=8021
FREESWITCH_PASSWORD=ClueCon
```

4. Configure SIP trunk in FreeSWITCH
5. Restart FreeSWITCH

## Creating Test Agent

Run this Python script to create a test agent:

```python
from app.models.agent import Agent
from app.core.security import get_password_hash
from app.core.database import SessionLocal

db = SessionLocal()

agent = Agent(
    username="8013",
    password_hash=get_password_hash("password"),
    phone_extension="8013",
    full_name="Test Agent",
    is_admin=0
)

db.add(agent)
db.commit()
print(f"Created agent: {agent.username}")
```

## Default Login

- **Phone Login**: 8013
- **User Login**: 8013
- **Password**: password (change in production!)

## API Endpoints

- `POST /api/auth/login` - Agent login
- `POST /api/auth/logout` - Agent logout
- `GET /api/agents/me` - Get current agent
- `POST /api/calls/dial` - Initiate call
- `POST /api/calls/hangup/{call_id}` - Hangup call
- `POST /api/calls/transfer/{call_id}` - Transfer call
- `POST /api/calls/park/{call_id}` - Park call
- `GET /api/calls/current` - Get current call
- `GET /api/stats/today` - Get today's statistics
- `GET /api/campaigns/` - List campaigns
- `POST /api/contacts/` - Create contact
- `PUT /api/contacts/{id}` - Update contact
- `WebSocket /ws` - Real-time updates

## Development

### Running Tests

Backend:
```bash
cd backend
pytest
```

Frontend:
```bash
cd frontend
npm test
```

### Building for Production

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:
```bash
cd frontend
npm run build
npm start
```

## Features Matching ViciDial

✅ Agent login with phone/user credentials  
✅ Campaign selection on login  
✅ Manual dialing  
✅ Call controls (Pause, Dial Next, Park, Transfer, Hangup)  
✅ Customer information form (all fields)  
✅ Real-time statistics (InBound, OutBound, Missed)  
✅ Session tracking  
✅ Break time and login time tracking  
✅ Admin portal structure  

## Roadmap

- [ ] Automated dialing (progressive/predictive)
- [ ] Call recording playback UI
- [ ] Advanced analytics and reporting
- [ ] Contact list bulk import (CSV/Excel)
- [ ] Call scripting system
- [ ] Multi-language support

## License

Private - A.M Marketing

## Support

For issues and questions, contact: 03235749236

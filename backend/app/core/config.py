from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/dialer_db"  # PostgreSQL
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Asterisk AMI (Asterisk Manager Interface)
    ASTERISK_HOST: str = "localhost"
    ASTERISK_AMI_PORT: int = 5038
    ASTERISK_AMI_USERNAME: str = "admin"
    ASTERISK_AMI_PASSWORD: str = "amp111"
    ASTERISK_CONTEXT: str = "from-internal"
    ASTERISK_TRUNK: str = "SIP/trunk"
    USE_MOCK_DIALER: bool = True
    
    # CORS - Default includes both ports
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Call Settings
    DEFAULT_CALL_TIMEOUT: int = 60
    MAX_CONCURRENT_CALLS: int = 10
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

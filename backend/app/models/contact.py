from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, TypeDecorator
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class ContactStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    NOT_ANSWERED = "not_answered"
    BUSY = "busy"
    FAILED = "failed"
    DO_NOT_CALL = "do_not_call"


class GenderType(str, enum.Enum):
    MALE = "M"
    FEMALE = "F"
    UNDEFINED = "U"


class EnumValueType(TypeDecorator):
    """TypeDecorator that ensures enum VALUES (not names) are stored in PostgreSQL enum columns"""
    impl = String
    cache_ok = True
    
    def __init__(self, enum_class, enum_name=None):
        super().__init__()
        self.enum_class = enum_class
        self.enum_name = enum_name or f"{enum_class.__name__.lower()}_enum"
        # Create a mapping from enum values to enum objects for fast lookup
        self._value_to_enum = {e.value: e for e in enum_class}
    
    def load_dialect_impl(self, dialect):
        # For PostgreSQL, use ENUM type directly with values (not names)
        if dialect.name == 'postgresql':
            # Use PostgreSQL ENUM with the actual enum values ('M', 'F', 'U')
            enum_values = [e.value for e in self.enum_class]
            return dialect.type_descriptor(PG_ENUM(*enum_values, name=self.enum_name, create_type=False))
        return dialect.type_descriptor(String)
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # CRITICAL: Convert enum object to its VALUE (string), not the name
        # This ensures we store 'M', 'F', 'U' in the database, not 'MALE', 'FEMALE', 'UNDEFINED'
        if isinstance(value, enum.Enum):
            enum_value = value.value
            # For PostgreSQL, cast to the enum type in SQL
            if dialect.name == 'postgresql':
                # Return a string that will be cast to the enum type
                # SQLAlchemy will handle the casting when we use the column
                return enum_value
            return enum_value
        # If it's already a string, return it as-is
        return str(value)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # CRITICAL: Database has enum VALUES ('M', 'F', 'U'), not names
        # Convert the value string to the corresponding enum object
        if isinstance(value, str):
            # Look up by value, not by name
            enum_obj = self._value_to_enum.get(value)
            if enum_obj is not None:
                return enum_obj
            # Fallback: try to find by value directly
            try:
                return self.enum_class(value)
            except ValueError:
                # If value doesn't match, return None
                return None
        # If it's already an enum, return it
        if isinstance(value, enum.Enum):
            return value
        return value


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    name = Column(String, nullable=True)
    phone = Column(String, nullable=False, index=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    # Use EnumValueType to ensure we store enum values ('M', 'F', 'U') not names
    # This works with PostgreSQL enum type by ensuring we pass the value, not the name
    # We use String as the Python type but PostgreSQL enum as the database type
    gender = Column(EnumValueType(GenderType, enum_name='gender_type_enum'), default=GenderType.UNDEFINED)
    whatsapp = Column(String, nullable=True)
    email = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    # Use EnumValueType for status as well to ensure we store enum values ('new', 'contacted', etc.) not names
    status = Column(EnumValueType(ContactStatus, enum_name='contact_status_enum'), default=ContactStatus.NEW)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    campaign = relationship("Campaign", back_populates="contacts")
    calls = relationship("Call", back_populates="contact")

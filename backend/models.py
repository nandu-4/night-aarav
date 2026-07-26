import uuid, enum
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Numeric, Boolean, Date, Text, ForeignKey, Enum as SAEnum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base

class AssignmentStatus(str, enum.Enum):
    pending="pending"; active="active"; at_risk="at_risk"; overdue="overdue"; complete="complete"; cancelled="cancelled"

class ComponentStatus(str, enum.Enum):
    not_started="not_started"; in_progress="in_progress"; complete="complete"; failed="failed"

class HilStatus(str, enum.Enum):
    draft="draft"; pending="pending"; approved="approved"; modified="modified"; rejected="rejected"

class EscalationStatus(str, enum.Enum):
    open="open"; resolved_extend="resolved_extend"; resolved_replace="resolved_replace"; resolved_accept_risk="resolved_accept_risk"; closed="closed"

class CertStatus(str, enum.Enum):
    pending="pending"; verified="verified"; registered="registered"

class LogLevel(str, enum.Enum):
    info="info"; warning="warning"; error="error"; action="action"


class Resource(Base):
    __tablename__ = "resources"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_code = Column(String(20), unique=True, nullable=False)
    full_name     = Column(String(120), nullable=False)
    role          = Column(String(100))
    department    = Column(String(100))
    email         = Column(String(200))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    assignments   = relationship("Assignment", back_populates="resource")
    certifications= relationship("Certification", back_populates="resource")

class RFP(Base):
    __tablename__ = "rfps"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfp_reference     = Column(String(50), unique=True, nullable=False)
    client_name       = Column(String(200))
    skill_required    = Column(String(200))
    proficiency_level = Column(String(50))
    cert_authority    = Column(String(200))
    engagement_start  = Column(Date)
    deployment_buffer = Column(Integer, default=7)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    assignments       = relationship("Assignment", back_populates="rfp")

class TrainingProgram(Base):
    __tablename__ = "training_programs"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_name    = Column(String(200), nullable=False)
    cert_name       = Column(String(200))
    skill_category  = Column(String(100))
    content_modules = Column(JSONB)
    total_duration_h= Column(Integer)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    assignments     = relationship("Assignment", back_populates="program")
    certifications  = relationship("Certification", back_populates="program")

class Assignment(Base):
    __tablename__ = "assignments"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id       = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    rfp_id            = Column(UUID(as_uuid=True), ForeignKey("rfps.id"), nullable=False)
    program_id        = Column(UUID(as_uuid=True), ForeignKey("training_programs.id"), nullable=False)
    assigned_date     = Column(Date)
    deadline          = Column(Date, nullable=False)
    content_status    = Column(SAEnum(ComponentStatus, name="component_status"), default=ComponentStatus.not_started)
    test_status       = Column(SAEnum(ComponentStatus, name="component_status"), default=ComponentStatus.not_started)
    case_study_status = Column(SAEnum(ComponentStatus, name="component_status"), default=ComponentStatus.not_started)
    overall_progress  = Column(Integer, default=0)
    status            = Column(SAEnum(AssignmentStatus, name="assignment_status"), default=AssignmentStatus.pending)
    test_score        = Column(Numeric(5,2))
    test_attempts     = Column(Integer, default=0)
    case_study_score  = Column(Numeric(5,2))
    notes             = Column(Text)
    learning_state    = Column(JSONB)   # learner progress: modules done, test answers, sandbox submission
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resource          = relationship("Resource", back_populates="assignments")
    rfp               = relationship("RFP", back_populates="assignments")
    program           = relationship("TrainingProgram", back_populates="assignments")
    hil_entries       = relationship("HilQueue", back_populates="assignment")
    escalations       = relationship("Escalation", back_populates="assignment")
    certifications    = relationship("Certification", back_populates="assignment")

class HilQueue(Base):
    __tablename__ = "hil_queue"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id    = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    recommended_by   = Column(String(100), default="system")
    reviewer_id      = Column(String(100))
    status           = Column(SAEnum(HilStatus, name="hil_status"), default=HilStatus.pending)
    proposed_program = Column(JSONB)
    reviewer_notes   = Column(Text)
    decision_ts      = Column(DateTime(timezone=True))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    assignment       = relationship("Assignment", back_populates="hil_entries")

class Escalation(Base):
    __tablename__ = "escalations"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id     = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    escalation_ts     = Column(DateTime(timezone=True), server_default=func.now())
    reason            = Column(Text)
    progress_snapshot = Column(JSONB)
    status            = Column(SAEnum(EscalationStatus, name="escalation_status"), default=EscalationStatus.open)
    resolved_by       = Column(String(100))
    resolution_notes  = Column(Text)
    resolved_ts       = Column(DateTime(timezone=True))
    new_deadline      = Column(Date)
    assignment        = relationship("Assignment", back_populates="escalations")

class Certification(Base):
    __tablename__ = "certifications"
    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id        = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    resource_id          = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    program_id           = Column(UUID(as_uuid=True), ForeignKey("training_programs.id"), nullable=False)
    cert_name            = Column(String(200))
    verified_date        = Column(Date)
    capability_updated   = Column(Boolean, default=False)
    capability_update_ts = Column(DateTime(timezone=True))
    deployment_clearance = Column(Date)
    status               = Column(SAEnum(CertStatus, name="cert_status"), default=CertStatus.pending)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    assignment           = relationship("Assignment", back_populates="certifications")
    resource             = relationship("Resource", back_populates="certifications")
    program              = relationship("TrainingProgram", back_populates="certifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ts           = Column(DateTime(timezone=True), server_default=func.now())
    rfp_ref      = Column(String(50))
    resource_id  = Column(String(100))
    action_type  = Column(String(100), nullable=False)
    entity_type  = Column(String(50))
    entity_id    = Column(UUID(as_uuid=True))
    original_val = Column(Text)
    new_val      = Column(Text)
    actor        = Column(String(100), default="system")
    level        = Column(SAEnum(LogLevel, name="log_level"), default=LogLevel.info)
    message      = Column(Text, nullable=False)

class Meeting(Base):
    __tablename__ = "meetings"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id          = Column(String(80), unique=True)
    context_type     = Column(String(40), nullable=False)      # e.g. "avathar_presentation"
    assignment_id    = Column(UUID(as_uuid=True), ForeignKey("assignments.id"))
    hil_id           = Column(UUID(as_uuid=True), ForeignKey("hil_queue.id"))
    meet_url         = Column(Text, nullable=False)
    bot_name         = Column(String(80), default="Aarav")
    status           = Column(String(40), nullable=False, default="starting")
    transcript       = Column(JSONB)
    duration_minutes = Column(Integer)
    started_by       = Column(String(100))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    ended_at         = Column(DateTime(timezone=True))


class MetricsSnapshot(Base):
    __tablename__ = "metrics_snapshots"
    id                          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_date               = Column(Date, default=date.today)
    assignment_rate_pct         = Column(Numeric(5,2))
    completion_rate_pct         = Column(Numeric(5,2))
    assessment_pass_rate_pct    = Column(Numeric(5,2))
    overdue_rate_pct            = Column(Numeric(5,2))
    cert_compliance_rate_pct    = Column(Numeric(5,2))
    hil_override_rate_pct       = Column(Numeric(5,2))
    capability_update_rate_pct  = Column(Numeric(5,2))
    avg_time_to_assignment_h    = Column(Numeric(8,2))
    created_at                  = Column(DateTime(timezone=True), server_default=func.now())

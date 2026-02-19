from .db import engine, Base


def init():
    # create tables if not exists (simple migration-free init for MVP)
    Base.metadata.create_all(bind=engine)

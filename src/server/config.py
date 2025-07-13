from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_path: str = "./db"
    port: int = 8000
    auth_key: str | None = None
    model_cache_path: str = "./cache"
    embedding_model_name: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    max_token_size: int = 8192

# Create a single instance of the settings
settings = Settings()
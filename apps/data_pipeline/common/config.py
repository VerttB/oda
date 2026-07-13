import logging
import sys
import os
DATA_DIR = "./data"
DGP_DATA_DIR = f"{DATA_DIR}/dgp"
os.makedirs(DGP_DATA_DIR, exist_ok=True)
LATTES_DATA_DIR = f"{DATA_DIR}/lattes"
os.makedirs(LATTES_DATA_DIR, exist_ok=True)
ISSUES_LOG = f"{DATA_DIR}/dgp/issues.log"
APP_LOG = f"{DATA_DIR}/dgp/scraper.log"
DB_FILE = f"{DATA_DIR}/dgp/scraper_estado.db"
DISCOVERY_LOG = f"{DATA_DIR}/dgp/discovery.log"
IMAGE_DIR = f"{DATA_DIR}/images"
os.makedirs(IMAGE_DIR, exist_ok=True)

# Configurações do ETL (Apache Hop)
# Se estiver rodando fora do Docker, use localhost:8080. 
# Se estiver dentro de outro container no mesmo network, use hop-web:8080.
HOP_SERVER_URL = "http://localhost:8080/hop" 
HOP_USER = "cluster"
HOP_PASS = "cluster"
HOP_WORKFLOW_PATH = "/files/apps/data_pipeline/hop/workflows/main_workflow.hwf"
ETL_BATCH_SIZE = 50 # Executar ETL a cada 50 grupos

dgp_logger = logging.getLogger("DgpScraper")
dgp_logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - %(message)s')

stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.DEBUG)
stdout_handler.setFormatter(formatter)
dgp_logger.addHandler(stdout_handler)

file_handler = logging.FileHandler(APP_LOG, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)
dgp_logger.addHandler(file_handler)

issues_handler = logging.FileHandler(ISSUES_LOG, encoding="utf-8")
issues_handler.setLevel(logging.ERROR)
issues_handler.setFormatter(formatter)
dgp_logger.addHandler(issues_handler)




sonda_logger = logging.getLogger("DiscoverySonda")
sonda_logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - %(message)s')

stdout_handler = logging.StreamHandler()
stdout_handler.setLevel(logging.DEBUG)
stdout_handler.setFormatter(formatter)
sonda_logger.addHandler(stdout_handler)

file_handler = logging.FileHandler(DISCOVERY_LOG, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)
sonda_logger.addHandler(file_handler)
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import docker.errors
import requests
from requests.auth import HTTPBasicAuth
from config import HOP_SERVER_URL, HOP_USER, HOP_PASS, HOP_WORKFLOW_PATH, dgp_logger as logger
import docker
def trigger_hop_workflow():
    client = docker.from_env()
   
    try:
        hop_container = client.containers.get("hop")
        hop_container.start()
        logger.info("Iniciando container apache hop")
        
        
        
    except docker.errors.NotFound:
        print("Container não encontrado")
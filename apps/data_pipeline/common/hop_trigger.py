import requests
from requests.auth import HTTPBasicAuth
from config import HOP_SERVER_URL, HOP_USER, HOP_PASS, HOP_WORKFLOW_PATH, dgp_logger as logger

def trigger_hop_workflow():
    """
    Aciona a execução do workflow principal no Apache Hop Server via API REST.
    """
   
    url = f"{HOP_SERVER_URL}/workflow/run"
    
    params = {
        "workflow": HOP_WORKFLOW_PATH,
        "run_config": "local"
    }
    
    logger.info(f"Triggering Apache Hop ETL: {HOP_WORKFLOW_PATH}")
    
    try:
        response = requests.get(
            url, 
            params=params, 
            auth=HTTPBasicAuth(HOP_USER, HOP_PASS),
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info("✅ Sinal de execução enviado ao Apache Hop com sucesso.")
            return True
        else:
            logger.error(f"❌ Falha ao acionar Hop ETL. Status: {response.status_code}, Resposta: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Erro de conexão ao tentar acionar o Apache Hop: {e}")
        return False

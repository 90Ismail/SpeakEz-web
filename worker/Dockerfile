FROM python:3.12-slim

WORKDIR /
COPY requirements.txt /worker/requirements.txt
RUN pip install --no-cache-dir -r /worker/requirements.txt

COPY . /worker

CMD ["arq", "worker.main.WorkerSettings"]

import { ClusteringWorkerBridge } from './worker-bridge';

let _workerBridge: ClusteringWorkerBridge | null = null;

export function getWorkerBridge(): ClusteringWorkerBridge {
  if (!_workerBridge) {
    _workerBridge = new ClusteringWorkerBridge();
  }
  return _workerBridge;
}

export function terminateWorker() {
  if (_workerBridge) {
    _workerBridge.terminate();
    _workerBridge = null;
  }
}

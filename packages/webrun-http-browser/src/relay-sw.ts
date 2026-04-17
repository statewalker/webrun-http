/// <reference lib="webworker" />

import { startRelayServiceWorker } from "./relay/index-sw.js";

declare const self: ServiceWorkerGlobalScope;

startRelayServiceWorker(self);

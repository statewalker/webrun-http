/// <reference lib="webworker" />

import { startHttpDispatcher } from "./sw/http-sw-dispatcher.js";

declare const self: ServiceWorkerGlobalScope;

startHttpDispatcher({ self, log: console.log });

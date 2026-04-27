import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import 'plyr/dist/plyr.css';
import { registerServiceWorker } from "./pwa";

const app = createApp(App);
app.mount("#app");
registerServiceWorker();

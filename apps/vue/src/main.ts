import "./style.css";

if (import.meta.env.DEV) {
  document.title = "OrbitQ Explorer (vue)";
}
import { createApp } from "vue";
import VueKonva from "vue-konva";
import { DefaultApolloClient } from "@vue/apollo-composable";
import { client } from "./lib/apollo";
import { router } from "./router";
import App from "./App.vue";

createApp(App)
  .use(router)
  .use(VueKonva)
  .provide(DefaultApolloClient, client)
  .mount("#root");

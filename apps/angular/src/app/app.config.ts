import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  inject,
} from "@angular/core";
import { provideRouter } from "@angular/router";

import { routes } from "./app.routes";
import { provideHttpClient } from "@angular/common/http";
import { provideApollo } from "apollo-angular";
import { HttpLink } from "apollo-angular/http";
import { InMemoryCache } from "@apollo/client";

const graphqlUrl =
  (import.meta as ImportMeta & { env?: { VITE_GRAPHQL_URL?: string } }).env
    ?.VITE_GRAPHQL_URL ?? "/graphql";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideApollo(() => {
      const httpLink = inject(HttpLink);

      return {
        link: httpLink.create({
          uri: graphqlUrl,
        }),
        cache: new InMemoryCache(),
      };
    }),
  ],
};

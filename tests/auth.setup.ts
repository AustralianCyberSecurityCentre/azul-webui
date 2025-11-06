import { test as setup } from "@playwright/test";
import { writeFileSync } from "fs";

// Location for the auth file to be cached to load for other tests.
const AUTH_FILE = "test-cache/.auth/user.json";
// Azure tenant id
const TENANT_ID = process.env.WEBUI_AZURE_TENANT_ID;
// Azure web app registration id
const WEBUI_APP_REGISTRATION_ID = process.env.WEBUI_AZUL_WEB_APP_ID;
// Azure azul-client app registration id.
const CLIENT_ID = process.env.WEBUI_AZUL_CLIENT_APP_ID;
// Define authority and login uri

const OIDC_WELLKNOWN_URI = `https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration`;

// Client scope required for auth to work:
const CLIENT_SCOPES = `openid profile email offline_access api://${WEBUI_APP_REGISTRATION_ID}/.default`;

// Load the azul client secret from an environment variable named AZUL_CLIENT_SECRET.
// You can also create one on the app registration for azul-client in Azure.
// const WEBUI_AZUL_CLIENT_SECRET = "FROM_ENVIRONMENT_VARIABLE";

setup("authenticate", async ({ request, baseURL }) => {
  // Get token endpoint from azure.
  let well_known = OIDC_WELLKNOWN_URI;
  if (process.env.WEBUI_WELLKNOWN_URI_OVERRIDE) {
    well_known = process.env.WEBUI_WELLKNOWN_URI_OVERRIDE;
  }
  console.log("Using well_known URI:", well_known);

  const wellknown_resp = request.get(well_known);
  const resp_json = await (await wellknown_resp).json();
  console.debug(
    "Well known response (should have token_endpoint), ",
    resp_json,
  );
  const token_endpoint = resp_json["token_endpoint"];
  console.log(`Loaded token endpoint: ${token_endpoint}`);

  // Get Authentication token.
  const auth_resp = await request.post(token_endpoint, {
    form: {
      response_type: "token",
      client_id: CLIENT_ID,
      client_secret: process.env.WEBUI_AZUL_CLIENT_SECRET,
      // client_secret: WEBUI_AZUL_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: CLIENT_SCOPES,
    },
    timeout: 30000, // 30 second timeout.
  });
  const auth_resp_json_body = await auth_resp.json();

  // Check if auth failed and why.
  if (auth_resp.status() != 200) {
    console.log("Auth response");
    console.log(auth_resp_json_body);
    throw Error(
      `Authentication failed with bad response code ${auth_resp.status()} and Error ${auth_resp_json_body["error_description"]}.`,
    );
  }

  console.log(auth_resp_json_body);
  // Built-in way of saving the current storage state, we use it just to create the directory structure.
  await request.storageState({ path: AUTH_FILE });

  // Stash the authentication token in the local directory ready for use by tests.
  // The format of this data was determined by checking a logged on users Application Storage.
  const localStorageKey = `0-${WEBUI_APP_REGISTRATION_ID}`;
  const localStorageData = JSON.stringify({
    authnResult: {
      token_type: auth_resp_json_body["token_type"],
      expires_in: auth_resp_json_body["expires_in"],
      ext_expires_in: auth_resp_json_body["ext_expires_in"],
      access_token: auth_resp_json_body["access_token"],
      // note using an access token as a id token because service accounts don't have an id token.
      id_token: auth_resp_json_body["access_token"],
    },
    authzData: auth_resp_json_body["access_token"],
  });

  const cachedStorage = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          {
            name: localStorageKey,
            value: localStorageData,
          },
          {
            // Prevent security warning popup for tests.
            name: "motd_date",
            value: new Date().getTime().toString(),
          },
        ],
      },
    ],
  };
  writeFileSync(AUTH_FILE, JSON.stringify(cachedStorage), "utf-8");
});

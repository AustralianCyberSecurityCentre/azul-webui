# Azul Webui

Graphical web user interface for Azul users.

Target platforms: Latest Firefox ESR, Latest Firefox, Latest Chrome.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 9.0.2.

The webui expects the restapi to be available at `/api` and docs available at `/docs`.
This is not configurable.

In a production setting, use nginx/apache to proxy these resources at the correct path.

## Development

There are several options for running azul-webui during development.

| Command                  | Restapi    | Auth           | Comments                           |
| ------------------------ | ---------- | -------------- | ---------------------------------- |
| `npm run local`          | local      | disabled       |                                    |
| `npm run local-keycloak` | local      | local keycloak | Requires cofigured local keycloak. |
| `npm run remote`         | remote qa  | remote qa      | Requires remote network.           |
| `npm run remote-dev`     | remote dev | remote dev     | Requires remote network.           |
| `npm run remote-local`   | local      | remote qa      | Requires remote network.           |

Webui will be available at http://localhost:4200.

### Develop stack

`npm run local`

Use this when running both webui and restapi locally, to verify that changes work together.

Due to the lack of data, it is difficult to verify changes, but this is the easiest way to get started without a fully deployed Azul instance.

All authentication in webui is disabled for simplicity.

Expects restapi available at http://localhost:8080
Optionally expects docs available at http://localhost:8000
Expects restapi auth to be disabled.

### Develop stack with keycloak oath

`npm run local-keycloak`

For testing/development of webui + a local restapi + local auth.

Most useful when changing something related to security but Keycloak is difficult to set up for Azul.

Expects restapi available at http://localhost:8080

### remote configuration

It may be desirable to test any ui changes with a larger data source than can be run locally.

For this reason you can configure a 'remote' Azul instance to connect with in order to test changes.

Rename `src/assets/alt-remote-template` to `src/assets/alt-remote` and edit as required.
This folder is excluded from git tracking.

#### remote - Develop stack with remote auth

`npm run remote-local`

Run webui + a local restapi + remote auth without remote data.

Expects restapi available at http://localhost:8080
Expects restapi to use remote auth.

#### remote - Develop stack with remote data and auth

`npm run remote`

`npm run remote-dev`

Run webui with remote data from qa or dev.

For development, QA is preferred, to avoid open PRs and outages interfering with your workflow.

## Building Docker Image

`docker build . -t azul-webui:latest`

## Updating package-lock.json

The package-lock.json is in the .gitignore file. This is due to not wanting to publish our mirror address.

The package-lock.json can be manually updated by using search-replace on the mirror address and then
performing an `git add --force package-lock.json` operation.

### Code scaffolding

Run `ng generate component component-name` to generate a new component.
You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

### Build

Run `ng build` to build the project.
The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

### Code formatting & linting

Run `npx prettier -w .` to format all code, and `npx eslint .` to check for linting issues. There are also VSCode
extensions which do this for you.

# Project Structure

Azul-webui follows a typical Angular application structure with a key dependency on `rxjs`.
The key concept of the project is to keep everything as a replayable observable.
This is to prevent memory leaks and to simplify development.

The folder structure of the project is as follows

- angular.json - Holds the build configuration for the project including different kinds of builds (prod vs testing)
- package.json - Holds the configurations to run the project including which can be used as `npm run remote`
- **src** - Main directory
  - index.html - The first page of the angular application (loaded when you browse to '/' of a website.
  - **app** - Main directory
    - **auth** - Holds the component that is used to authenticate users
    - **common** - Holds commonly used components like loading components,
      pipes (used to modify how data is rendered) and security rendering
    - **core** - Holds most of the services that are injected into the application.
      (multiple are injected into 'root' and are always running)
      - entity.service.ts - This holds the EntityWrapper and the EntityService which are quite complex
        due to caching and buffering that is implemented to improve performance.
      - **api** - Folder that holds all of the API calls that are made to the
        Azul Rest API when rendering information for the user.
    - **entity-cards** - Holds all of the components that are used to display information about entities.
      This is to keep them organised as there are multiple entity pages
    - **pages** - Holds all of the pages that are rendered to a user and
      are composed of components defined in common/core and entity-cards.
      - pages.component - The root page that holds the nav bar and the main router-outlet.
      - page-routing.module.ts - Holds most of the routes for the application.
      - testbed - Special page that is used just for testing newly created components,
        browse to it with `base-url/pages/test`, there is no route for it in the navbar.
    - app-routing.module.ts - Root configuration for all routing in an angular project.
    - app.module.ts - Root configuration for an angular project.
  - **assets** - Static resources or configuration for website.

### entity.services.ts

As a quick summary for how entity.service.ts buffering works.
There is a subscription that is always running called entitiesSimpleBuffer this service accepts requests
to get simple copies (summaries) of entities and buffers at most 10 (for 200ms)
and sends a bulk API request to get all of the summary information.

Once the summaries are retrieved it passes the information back to the caller through a Subject and then completes the
subject.

To interface with the entitiesSimpleBuffer, either the entity or entitySimple API calls are used.
The entitySimple just provides the summary provided by the buffer directly back to the caller.

The entity API on the other hand creates and returns an EntityWrapper and
then calls the buffer to get the summary information.
The summary information is provided to the EntityWrapper as a subject into it's constructor which the EntityWrapper
stores in an observable.
The EntityWrapper also makes many other API requests to get other information about the entity at the same time.

# Updating all npm packages

To update angular and all other npm packages to the latest version, run the following commands:

Note - ensure you've got a clean repo (no active changes)

```bash
# Update angular devkit
ng update @angular-devkit/build-angular
# Remove package.lock.json
rm -r package.lock.json
# Update all packages
npx npm-check-updates --upgrade --target "minor"
# Install updated packages
npm install
```

If the `npm install` fails due to dependent packages being incompatible you need to manually fix the package.json file.

You may also want to remove package-lock.json.

## End to end tests

End to end tests are written with playwright and stored in the azul-webui/tests folder.

REQUIRED ENVIRONMENT VARIABLES:
Tenant ID for Azure
`export WEBUI_AZURE_TENANT_ID=<value-here>`
The app registration ID for the azul-web App registration (found on Azure)
`export WEBUI_AZUL_WEB_APP_ID=<value-here>`
The app registration ID for the azul-client App registration (found on Azure)
`export WEBUI_AZUL_CLIENT_APP_ID=<value-here>`
Also acquired from Azure but you need to generate your own secret.
`export WEBUI_AZUL_CLIENT_SECRET=<value-here>`
Additional optional environment variable, if you need to override the fqdn for the well_known uri which holds the token endpoint.
`export WEBUI_WELLKNOWN_URI_OVERRIDE=<value-here>`

generate their own secret and set it in their `~/.bashrc` or equivalent.

To run the tests you need to first install the linux dependencies with the command:
`npx playwright install-deps`
also install all the debian packages in dev-debian.txt:
`xargs sudo apt-get install < dev-debian.txt`

To run the tests you use the command:
`npm run e2e`

You can also startup the dev server with `npm run start` before running the tests and it will run faster.
Because it will use the already running server rather than starting it's own.

### Debugging Tests / playwright GUI

To run playwright smoke tests in a GUI which allows the webui state to be viewed use the following command:
`npx playwright test --ui --ui-port 7312 --project firefox`

To run the much slower full suite of tests, set the COMPREHENSIVE environment variable:
`COMPREHENSIVE=true npx playwright test --ui --ui-port 7312 --project firefox`

Supported projects are 'firefox' and 'chromium'.

### Code gen

Playwright does have builtin code gen tools, but they don't appear to be usable when vscode is running via ssh.
It should be possible to run playwright's codegen with the following:

```bash
xvfb-run npm run start
npx playwright codegen
```

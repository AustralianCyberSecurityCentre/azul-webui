import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { setConfig } from "./app/settings";
import { environment } from "./environments/environment";

if (environment.production) {
  enableProdMode();
}

/**start the acutual angular app*/
function runAngular() {
  import("./app/app.module").then((appmodule) => {
    // console.log('appmodule', appmodule)
    // Load the actual app
    platformBrowserDynamic()
      .bootstrapModule(appmodule.AppModule)
      .catch((err) => console.error(err));
  });
}

/**load basic config and attempt to load oauth*/
function loadConfigAndRun() {
  fetch("assets/config.json")
    .then((response) => response.json())
    .then((json) => {
      console.log("dynamically loaded config", json);
      setConfig(json);
    })
    .then(
      // () => configureOauth(),
      () => runAngular(),
      (e) =>
        alert(
          "Could not load Azul webui configuration. Please try refreshing the page. " +
            String(e),
        ),
    );
}

function checkLocalStorage() {
  // test if local storage is working properly in the browser
  const test = "check";
  try {
    console.log("check - set item with local storage");
    localStorage.setItem(test, test);
    console.log("check - delete item from local storage");
    localStorage.removeItem(test);
    console.log("local storage success");
  } catch {
    console.error("local storage failed");
    alert(
      'Your browser does not allow Azul to use "Window.localStorage", Azul is unlikely to work properly. Please try restarting your browser or using a different browser.',
    );
  }
}

checkLocalStorage();
loadConfigAndRun();

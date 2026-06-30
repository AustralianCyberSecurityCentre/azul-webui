import {
  effect,
  inject,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { Observable, of } from "rxjs";
import * as ops from "rxjs/operators";

import { toSignal } from "@angular/core/rxjs-interop";
import { ApiService } from "./api/api.service";
import { components } from "./api/openapi";

/**provides helpers for handling user information*/
@Injectable({
  providedIn: "root",
})
export class UserService {
  dbg = (...d) => console.debug("UserService: ", ...d);
  err = (...d) => console.error("UserService", d);

  /**true if debug mode is enabled**/
  dbgSignal: WritableSignal<boolean> = signal(false);

  /**info about current user from restapi*/
  userDetails$: Observable<components["schemas"]["UserInfo"]>;
  /**info about current user from opensearch*/
  userDetailsOpensearch$: Observable<components["schemas"]["UserAccess"]>;
  isUserAdmin$: Observable<boolean>;
  isUserAdminSignal: Signal<boolean>;
  /** current users username */
  username$: Observable<string>;
  /** username with the first letter capital, used to for NbUserComponent */
  fmtUsername$: Observable<string>;

  constructor() {
    const api = inject(ApiService);

    this.userDetails$ = api
      .userDetail()
      .pipe(ops.retry({ count: 5, delay: 2000 }), ops.shareReplay(1));
    this.userDetailsOpensearch$ = api
      .userDetailOpensearch()
      .pipe(ops.retry({ count: 5, delay: 2000 }), ops.shareReplay(1));
    this.isUserAdmin$ = api
      .isUserAdmin()
      .pipe(ops.retry({ count: 5, delay: 2000 }), ops.shareReplay(1));
    this.isUserAdminSignal = toSignal(
      api
        .isUserAdmin()
        .pipe(ops.retry({ count: 5, delay: 2000 }), ops.shareReplay(1)),
    );
    this.username$ = this.userDetails$.pipe(
      ops.map((d) => d.username),
      ops.catchError((_e) => of("error")),
    );

    // The following capitalizes the first letter of the username
    this.fmtUsername$ = this.userDetails$.pipe(
      ops.map(
        (d) =>
          d.username.charAt(0).toUpperCase() +
          d.username.slice(1).toLowerCase(),
      ),
      ops.catchError((_e) => of("error")),
    );

    // load debug settings
    const dbgConfig = JSON.parse(
      localStorage.getItem("debugConfig") || '{"enabled": false}',
    );
    this.dbgSignal.set(dbgConfig.enabled);
    effect(() => {
      localStorage.setItem(
        "debugConfig",
        JSON.stringify({ enabled: this.dbgSignal() }),
      );
    });
  }
}

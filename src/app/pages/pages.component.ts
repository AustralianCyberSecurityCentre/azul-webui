import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  WritableSignal,
  signal,
  inject,
} from "@angular/core";
import { Api, Nav, Security, User } from "src/app/core/services";
import { DynamicConfig, config } from "src/app/settings";

import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { SizeProp } from "@fortawesome/fontawesome-svg-core";
import {
  faAngleDown,
  faArrowUp,
  faBars,
  faCaretDown,
  faCircleCheck,
  faCircleUser,
  faCircleXmark,
  faDragon,
  faRightFromBracket,
  faSliders,
  faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { AxiosError } from "axios";
import { Subscription, of } from "rxjs";
import * as ops from "rxjs/operators";

@Component({
  selector: "app-pages",
  templateUrl: "./pages.component.html",
  styleUrls: ["./pages.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PagesComponent implements AfterViewInit, OnDestroy {
  protected nav = inject(Nav);
  protected user = inject(User);
  private dialogService = inject(Dialog);
  protected securityService = inject(Security);
  protected api = inject(Api);
  private router = inject(Router);

  @ViewChild("tplMotd") protected tplMotd: TemplateRef<unknown>;
  @ViewChild("tplUserInfo") protected tplUserInfo: TemplateRef<unknown>;

  dbg = (...d) => console.debug("PagesComponent:", ...d);
  err = (...d) => console.error("PagesComponent:", ...d);

  protected faCaretDown = faCaretDown;
  protected faAngleDown = faAngleDown;
  protected faSliders = faSliders;
  protected faCircleUser = faCircleUser;
  protected faDragon = faDragon;
  protected faUpRightFromSquare = faUpRightFromSquare;
  protected faArrowUp = faArrowUp;
  protected faCircleCheck = faCircleCheck;
  protected faCircleXmark = faCircleXmark;
  protected faBars = faBars;
  protected faRightFromBracket = faRightFromBracket;
  protected readonly largeSizeIcon: SizeProp = "lg";

  hasMargin: WritableSignal<boolean> = signal<boolean>(false);
  hasScroll: WritableSignal<boolean> = signal<boolean>(false);
  private pageWatcher$: Subscription;

  config: DynamicConfig = config;
  oauth: boolean = config?.oauth_enabled;
  motdExpiry = (config?.motd_hours || 0) * 60 * 60 * 1000;

  private dialog: DialogRef;
  private suspendDialogs = false;

  motdKey = "motd_date";

  constructor() {
    const router = this.router;
    const activatedRoute = inject(ActivatedRoute);

    this.pageWatcher$ = router.events
      .pipe(
        ops.filter((event) => event instanceof NavigationEnd), // Only get the event of NavigationEnd
        ops.map(() => activatedRoute), // Listen to activateRoute
        ops.map((route) => {
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        }),
        ops.filter((route) => route.outlet === "primary"),
        ops.mergeMap((route) => route.data),
      )
      .subscribe((d) => {
        this.hasMargin.set(!d["noMargin"]);
        this.hasScroll.set(!d["noScroll"]);

        this.dbg("noMargin", d["noMargin"]);
        this.dbg("noScroll", d["noScroll"]);
      });
  }

  ngOnDestroy() {
    this.pageWatcher$?.unsubscribe();
  }

  ngAfterViewInit() {
    const motd_date = parseInt(localStorage.getItem(this.motdKey)) || 0;
    const motd_expiry = new Date(
      new Date().getTime() - this.motdExpiry,
    ).getTime();
    if (config?.motd_body) {
      if (motd_expiry > motd_date) {
        this.dbg("must acknowledge motd again");
        setTimeout(() => {
          if (!this.suspendDialogs) {
            localStorage.setItem(this.motdKey, new Date().getTime().toString());
            this.dialogShow(this.tplMotd);
          }
        }, 50);
      } else {
        this.dbg("motd acknowledgement still valid");
      }
    } else {
      this.dbg("no motd set, not displaying dialog");
    }

    // Determine if the user meets the minimum required access for the system
    this.api
      .userDetailOpensearch()
      .pipe(
        ops.map((_) => {}),
        ops.catchError((err, _caught) => {
          if (this.securityService.isReauthenticating()) {
            // Auth errors during reauthentication make sense!
            return;
          }

          console.error("Authentication failure:", err);

          // Try to clean up this HTTP error for presentation
          let errMsg = "" + err;
          if (err instanceof AxiosError && err.response !== undefined) {
            if ("detail" in err.response.data) {
              errMsg += ", " + err.response.data.detail;
            } else if ("message" in err.response.data) {
              errMsg += ", " + err.response.data.message;
            } else {
              errMsg += ", " + JSON.stringify(err.response.data);
            }
          }

          // Stop dialogs being opened from this point
          this.suspendDialogs = true;

          if (this.dialog) {
            this.dialogClose();
          }

          this.router.navigate(["/unauthorized"], {
            state: { exception: errMsg },
          });
          return of(null);
        }),
      )
      .subscribe();
  }

  protected dialogShow(tpl) {
    if (this.dialog) {
      this.dialogClose();
    }
    this.dialog = this.dialogService.open(tpl);
  }

  protected dialogClose() {
    this.dialog.close();
    this.dialog = null;
  }
}

import { Injectable } from "@angular/core";
import { AbstractSecurityStorage } from "angular-auth-oidc-client";

/**
 * Utilises local storage (as opposed to session storage) for storing
 * OIDC data.
 *
 * https://angular-auth-oidc-client.com/docs/documentation/custom-storage
 */
@Injectable()
export class LocalStorageService implements AbstractSecurityStorage {
  read(key: string) {
    return localStorage.getItem(key);
  }

  write(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }
}

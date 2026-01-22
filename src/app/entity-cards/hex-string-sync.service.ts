import { Injectable, signal, WritableSignal } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class HexStringSyncService {
  public HexOffsetSignal: WritableSignal<number> = signal(-1);
  constructor() {}
}

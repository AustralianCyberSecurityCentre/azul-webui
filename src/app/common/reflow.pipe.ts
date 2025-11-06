import { Pipe, PipeTransform } from "@angular/core";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { parseISO } from "date-fns/parseISO";

import { components } from "../core/api/openapi";

@Pipe({
  name: "since",
  standalone: false,
})
export class SincePipe implements PipeTransform {
  transform(
    value: string | Date | number | undefined,
    prefix: string = "",
    postfix: string = "",
    fail: string = "",
  ): string {
    if (value == undefined) {
      // Display empty string if the target date is undefined
      return fail;
    }
    // Transform time delta to provided date to a human readable string, e.g. "a minute ago"
    let date = value;
    if (typeof value === "string") {
      date = parseISO(value);
    } else if (typeof value === "number") {
      date = new Date(value);
    }
    const res = formatDistanceToNow(date, { addSuffix: true });

    return `${prefix}${res}${postfix}`;
  }
}

@Pipe({
  name: "joinPipe",
  standalone: false,
})
export class JoinPipe implements PipeTransform {
  transform(value: [string]): string {
    if (value == undefined) {
      return "";
    }

    return value.join(" | ");
  }
}

@Pipe({
  name: "filesize",
  standalone: false,
})
export class FilesizePipe implements PipeTransform {
  divisors = [1000, 1000, 1000, 1000, 1000];
  labels = ["B", "kB", "MB", "GB", "TB", "PB", "EB"];
  transform(value: number): string {
    if (value == undefined) {
      return "";
    }
    let diff = value;

    let i = 0;
    for (; i < this.divisors.length; i++) {
      if (diff < this.divisors[i]) {
        break;
      }
      diff = diff / this.divisors[i];
    }

    return `${Math.round(diff)} ${this.labels[i]}`;
  }
}

@Pipe({
  name: "hex",
  standalone: false,
})
export class HexPipe implements PipeTransform {
  transform(value: number): string {
    if (value == undefined) {
      return "";
    }
    return `${Math.round(value).toString(16).padStart(8, "0")}`;
  }
}

@Pipe({
  name: "instance",
  standalone: false,
})
export class AuthorInstancePipe implements PipeTransform {
  transform(
    value: components["schemas"]["EntityInstance"],
    long: boolean = false,
  ): string {
    if (value == undefined) {
      return "";
    }
    if (!long) {
      return `${
        value.author.category != "plugin" ? value.author.category : ""
      } ${value.author.name}`;
    } else {
      return `${value.author.category} ${value.author.name} ${value.author.version} ${value.stream}`;
    }
  }
}

@Pipe({
  name: "author",
  standalone: false,
})
export class AuthorPipe implements PipeTransform {
  transform(
    value: components["schemas"]["azul_bedrock__models_network__Author"],
    long: boolean = false,
  ): string {
    if (value == undefined) {
      return "";
    }
    if (!long) {
      return `${
        value.category != "plugin" ? value.category : ""
      } ${value.name}`;
    } else {
      return `${value.category} ${value.name} ${value.version}`;
    }
  }
}

/** convert time in seconds to easily human-readable format */
@Pipe({
  name: "friendlyTime",
  standalone: false,
})
export class FriendlyTimePipe implements PipeTransform {
  transform(value: number): string {
    const time = Math.ceil(value * 10) / 10;
    if (time != 0 && !time) {
      return "";
    } else if (time < 60) {
      // 1 min
      return time.toFixed(1) + "s";
    } else if (time < 3600) {
      // 1 hr
      return (time / 60).toFixed(1) + "m";
    } else {
      return (time / (60 * 60)).toFixed(1) + "h";
    }
  }
}

/** Converts a username to one or two initials based on the username */
@Pipe({
  name: "userInitials",
  standalone: false,
})
export class UserInitialsPipe implements PipeTransform {
  transform(username: string | undefined): string | undefined {
    if (username === undefined || username === null || username === "") {
      return undefined;
    }

    const prefix = username.split("@");
    const components = prefix[0].split(".");
    const validComponents: string[] = [];
    // find suitable candidates to base initials on
    for (const component of components)
      if (component.length > 0) {
        let isAlpha = false;
        isAlpha = /[a-zA-Z]/.test(component);
        if (isAlpha) {
          validComponents.push(component);
        }
      }
    // If there is a valid name, but no seperating '.'
    if (validComponents.length == 1) {
      const firstName = validComponents[0];
      for (const letter of firstName) {
        if (/[a-zA-Z]/.test(letter)) {
          return letter.toUpperCase();
        }
      }
      // If no valid username is detected
    } else if (validComponents.length < 1) {
      return "";
      // If atleast 2 valid names seperated by a '.' is detected
    } else {
      const firstName = validComponents[0];
      let firstInitial = "";
      for (const letter of firstName) {
        if (/[a-zA-Z]/.test(letter)) {
          firstInitial = letter.toUpperCase();
          break;
        }
      }
      const lastName = validComponents[1];
      let secondInitial = "";
      for (const letter of lastName) {
        if (/[a-zA-Z]/.test(letter)) {
          secondInitial = letter.toUpperCase();
          break;
        }
      }
      const initials = firstInitial + secondInitial;
      return initials;
    }
    return "";
  }
}

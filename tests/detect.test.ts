// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyForm,
  collectCandidate,
  describeField,
  detectLoginForms,
  fillFields,
  findLoginPairForElement,
  hasVisiblePasswordField,
  isUsernameDescriptor,
  visiblePasswordFields,
} from "../extension/src/detect";

beforeEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value(): DOMRectList {
      const rect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 20,
        right: 120,
        width: 120,
        height: 20,
        toJSON: () => ({}),
      };
      return Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
    },
  });
});

function loginForm(): HTMLFormElement {
  document.body.innerHTML = `
    <form>
      <input type="email" name="email" autocomplete="username" />
      <input type="password" name="password" autocomplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
  `;
  const form = document.querySelector("form");
  if (!form) throw new Error("form missing");
  return form;
}

describe("login form detection", () => {
  it("finds a username/password pair and classifies a login form", () => {
    const form = loginForm();
    const results = detectLoginForms(document);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("login");
    expect(results[0].pair.username?.name).toBe("email");
    expect(results[0].pair.password.name).toBe("password");
    expect(classifyForm(form, 1)).toBe("login");
  });

  it("classifies two-password forms as signup and rejects empty candidates", () => {
    document.body.innerHTML = `
      <form>
        <input type="email" name="email" />
        <input type="password" name="password" autocomplete="new-password" />
        <input type="password" name="confirm" autocomplete="new-password" />
        <button type="submit">Create account</button>
      </form>
    `;
    const results = detectLoginForms(document);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("signup");
    expect(collectCandidate(results[0].pair)).toBeNull();

    results[0].pair.username!.value = "ada@example.com";
    results[0].pair.password.value = "secret";
    expect(collectCandidate(results[0].pair)).toEqual({
      username: "ada@example.com",
      password: "secret",
    });
  });

  it("finds password fields that are not inside a form", () => {
    document.body.innerHTML = `
      <main>
        <div>
          <input type="text" name="identifier" placeholder="Email or username" />
          <input type="password" id="pass" />
          <div role="button">Continue</div>
        </div>
      </main>
    `;
    const results = detectLoginForms(document);
    expect(results).toHaveLength(1);
    expect(results[0].pair.username?.name).toBe("identifier");
    expect(results[0].kind).toBe("unknown");
    expect(hasVisiblePasswordField()).toBe(true);
  });

  it("does not treat a hidden password input as fillable", () => {
    document.body.innerHTML = `
      <form>
        <input type="text" name="user" />
        <input type="password" name="password" style="display: none" />
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (!password) throw new Error("password missing");
    expect(describeField(password).visible).toBe(false);
    expect(visiblePasswordFields(document)).toHaveLength(0);
    expect(detectLoginForms(document)).toHaveLength(0);
  });

  it("prefers an explicit email field over a generic text field", () => {
    document.body.innerHTML = `
      <form>
        <input type="text" name="search" placeholder="Search" />
        <input type="email" name="login_email" />
        <input type="password" name="password" />
      </form>
    `;
    const results = detectLoginForms(document);
    expect(results[0].pair.username?.name).toBe("login_email");
  });

  it("recognizes username descriptors", () => {
    expect(
      isUsernameDescriptor({
        type: "email",
        name: "email",
        id: "",
        autocomplete: "username",
        placeholder: "",
        value: "",
        disabled: false,
        visible: true,
      }),
    ).toBe(true);
    expect(
      isUsernameDescriptor({
        type: "search",
        name: "q",
        id: "",
        autocomplete: "",
        placeholder: "Search",
        value: "",
        disabled: false,
        visible: true,
      }),
    ).toBe(false);
  });
});

describe("filling fields", () => {
  it("sets native values and dispatches input/change events", () => {
    document.body.innerHTML = `
      <form>
        <input type="email" name="email" />
        <input type="password" name="password" />
      </form>
    `;
    const password = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (!password) throw new Error("password missing");
    const pair = findLoginPairForElement(password);
    if (!pair) throw new Error("pair missing");

    let inputs = 0;
    let changes = 0;
    pair.password.addEventListener("input", () => (inputs += 1));
    pair.password.addEventListener("change", () => (changes += 1));

    expect(fillFields(pair, "ada@example.com", "s3cret")).toBe(true);
    expect(pair.username?.value).toBe("ada@example.com");
    expect(pair.password.value).toBe("s3cret");
    expect(inputs).toBeGreaterThan(0);
    expect(changes).toBeGreaterThan(0);
  });
});

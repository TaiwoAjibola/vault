declare const __KEYHOLD_CONFIG__: {
  supabaseUrl: string;
  anonKey: string;
  appUrl: string;
};

export const config = __KEYHOLD_CONFIG__;

export function appLink(path = "/app"): string {
  return `${config.appUrl.replace(/\/$/, "")}${path}`;
}

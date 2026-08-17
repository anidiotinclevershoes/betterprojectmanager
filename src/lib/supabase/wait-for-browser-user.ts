import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Wait until the browser Supabase client has a usable session.
 *
 * On hard refresh, `/api/auth/me` can already see httpOnly cookies while
 * `createBrowserClient().auth.getUser()` is still empty. Loading the
 * workspace before the browser session is ready throws "Not authenticated"
 * and used to leave MissionProvider stuck on an empty workspace.
 *
 * Subscribe to auth changes before the first getUser() so INITIAL_SESSION
 * cannot be missed during that await.
 */
export async function waitForBrowserUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<User> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const pollMs = options?.pollMs ?? 150;

  return new Promise<User>((resolve, reject) => {
    let settled = false;

    const finish = (user: User) => {
      if (settled) return;
      settled = true;
      clearInterval(pollId);
      clearTimeout(timerId);
      subscription.unsubscribe();
      resolve(user);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearInterval(pollId);
      clearTimeout(timerId);
      subscription.unsubscribe();
      reject(new Error(message));
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      if (
        !user ||
        (event !== "INITIAL_SESSION" &&
          event !== "SIGNED_IN" &&
          event !== "TOKEN_REFRESHED")
      ) {
        return;
      }
      finish(user);
    });

    const pollId = setInterval(() => {
      void (async () => {
        try {
          const {
            data: { user },
          } = await client.auth.getUser();
          if (user) finish(user);
        } catch {
          /* keep waiting */
        }
      })();
    }, pollMs);

    const timerId = setTimeout(() => {
      fail("Timed out waiting for Supabase browser session");
    }, timeoutMs);

    void (async () => {
      try {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          finish(user);
          return;
        }
        const {
          data: { session },
        } = await client.auth.getSession();
        if (session?.user) {
          const {
            data: { user: validated },
          } = await client.auth.getUser();
          if (validated) finish(validated);
        }
      } catch {
        /* keep waiting for auth events / poll */
      }
    })();
  });
}

"use client";
export function AuthPage({ isSignin }: { isSignin: boolean }) {
  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <div className="p-6 m-2 bg-white rounded">
        <div>
          <input type="text" placeholder="email" />
        </div>
        <div className="p-2">
          <input type="password" placeholder="password" />
        </div>
        <div className="pt-2">
          <button onClick={() => {}}>{isSignin ? "Sign In" : "Sign up"}</button>
        </div>
      </div>
    </div>
  );
}

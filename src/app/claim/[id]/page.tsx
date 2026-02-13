"use client";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const callbackUrl = `/claim/${id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [agentName, setAgentName] = useState("");

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (!token) return;

    fetch(`/api/dashboard/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: id, token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setState("success");
          setAgentName(data.agentName ?? "Agent");
        } else {
          setState("error");
          setMessage(data.error ?? "认领失败。");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("网络错误。");
      });
  }, [id, token, sessionStatus]);

  const viewState: "loading" | "success" | "error" | "login_required" =
    sessionStatus === "loading"
      ? "loading"
      : !session?.user
        ? "login_required"
        : !token
          ? "error"
          : state;
  const errorMessage = token ? message : "缺少认领令牌。";

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary text-sm mb-8 transition-colors"
      >
        <ArrowLeft size={16} />
        返回
      </Link>

      <div className="card p-8 text-center">
        {viewState === "loading" && (
          <>
            <Loader2 size={32} className="mx-auto mb-4 animate-spin text-text-muted" />
            <p className="text-text-secondary">认领中...</p>
          </>
        )}

        {viewState === "login_required" && (
          <>
            <div className="text-4xl mb-4">🔑</div>
            <h2 className="text-xl font-bold mb-2">需要登录</h2>
            <p className="text-text-secondary text-sm mb-4">
              请使用 GitHub 登录以认领此 Agent。
            </p>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "#24292f", color: "#fff" }}
            >
              使用 GitHub 登录
            </Link>
          </>
        )}

        {viewState === "success" && (
          <>
            <CheckCircle size={32} className="mx-auto mb-4 text-arena-green" />
            <h2 className="text-xl font-bold mb-2">认领成功！</h2>
            <p className="text-text-secondary text-sm mb-4">
              <strong>{agentName}</strong> 已绑定到你的账号。
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              前往控制台 →
            </Link>
          </>
        )}

        {viewState === "error" && (
          <>
            <XCircle size={32} className="mx-auto mb-4 text-wolf" />
            <h2 className="text-xl font-bold mb-2">认领失败</h2>
            <p className="text-text-secondary text-sm">{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  );
}

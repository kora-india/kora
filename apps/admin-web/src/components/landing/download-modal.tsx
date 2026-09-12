"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Monitor,
  Apple,
  Download,
  X,
  CheckCircle2,
  Laptop,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OS = "mac-arm" | "mac-intel" | "win" | "unknown";

export function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const [mounted, setMounted] = useState(false);
  const [detectedOS, setDetectedOS] = useState<OS>("mac-arm");

  useEffect(() => {
    setMounted(true);

    const ua = window.navigator.userAgent.toLowerCase();
    const isMac = /macintosh|mac os x/.test(ua);
    const isWin = /windows nt/.test(ua);

    if (isWin) {
      setDetectedOS("win");
      return;
    }

    if (isMac) {
      // 1. Check WebGL GPU renderer (Apple Silicon reports "Apple M1/M2/M3" or "Apple GPU")
      let isArm = true;
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") ||
          (canvas.getContext(
            "experimental-webgl",
          ) as WebGLRenderingContext | null);
        if (gl) {
          const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
          if (debugInfo) {
            const renderer = (
              gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ""
            ).toLowerCase();
            if (
              renderer.includes("intel") ||
              renderer.includes("amd") ||
              renderer.includes("radeon") ||
              renderer.includes("nvidia")
            ) {
              isArm = false;
            } else if (renderer.includes("apple")) {
              isArm = true;
            }
          }
        }
      } catch {
        isArm = true;
      }

      setDetectedOS(isArm ? "mac-arm" : "mac-intel");

      // 2. Double-check with Chromium high-entropy Client Hints if available
      const nav = window.navigator as any;
      if (nav.userAgentData?.getHighEntropyValues) {
        nav.userAgentData
          .getHighEntropyValues(["architecture"])
          .then((data: any) => {
            if (data?.architecture === "arm") {
              setDetectedOS("mac-arm");
            } else if (data?.architecture === "x86") {
              setDetectedOS("mac-intel");
            }
          })
          .catch(() => {});
      }
    } else {
      setDetectedOS("mac-arm");
    }
  }, []);

  // Handle ESC key and scroll-lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const downloadTargets = [
    {
      id: "mac-arm",
      name: "macOS (Apple Silicon)",
      desc: "For Mac M1, M2, M3, M4 & newer",
      icon: Apple,
      chip: "ARM64",
      ext: ".dmg",
      downloadUrl:
        "https://github.com/kora-india/kora/releases/latest/download/Kora-1.0.0-mac-arm64.dmg",
      isRecommended: detectedOS === "mac-arm",
    },
    {
      id: "mac-intel",
      name: "macOS (Intel)",
      desc: "For older Intel-based Macs",
      icon: Apple,
      chip: "x64",
      ext: ".dmg",
      downloadUrl:
        "https://github.com/kora-india/kora/releases/latest/download/Kora-1.0.0-mac-x64.dmg",
      isRecommended: detectedOS === "mac-intel",
    },
    {
      id: "win",
      name: "Windows (64-bit)",
      desc: "For Windows 10 & 11",
      icon: Monitor,
      chip: "x64",
      ext: ".exe",
      downloadUrl:
        "https://github.com/kora-india/kora/releases/latest/download/Kora-1.0.0-win-x64.exe",
      isRecommended: detectedOS === "win",
    },
  ];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 z-10 my-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 mb-3 shadow-inner">
                <Laptop className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Download Kora Desktop
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Experience high-performance native desktop management for your
                school.
              </p>
            </div>

            {/* Options List */}
            <div className="space-y-3">
              {downloadTargets.map((target) => {
                const IconComponent = target.icon;
                return (
                  <a
                    key={target.id}
                    href={target.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group ${
                      target.isRecommended
                        ? "border-violet-500 bg-violet-50/50 hover:bg-violet-100/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          target.isRecommended
                            ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                            : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {target.name}
                          </span>
                          {target.isRecommended && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-violet-600 text-white">
                              Detected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {target.desc} •{" "}
                          <span className="font-mono text-[11px] font-semibold text-slate-600">
                            {target.ext}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <Download className="w-4 h-4" />
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Features footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs text-slate-500">
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Instant Startup</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Direct Admin Login</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

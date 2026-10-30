import { createFileRoute } from "@tanstack/react-router";
import { AuditorApp } from "@/components/auditor/AuditorApp";

export const Route = createFileRoute("/")({ component: AuditorApp });

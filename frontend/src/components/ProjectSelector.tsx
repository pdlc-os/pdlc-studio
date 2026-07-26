import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "@astryxdesign/core/Button";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { FolderOpen, FolderPlus, GitBranch } from "lucide-react";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";
import { DirectoryPickerDialog } from "./DirectoryPickerDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { CloneRepositoryDialog } from "./CloneRepositoryDialog";
import { AppIcon } from "./AppIcon";

/** Which modal is currently open. Only one can be at a time. */
type ActiveDialog = "none" | "open" | "new" | "clone" | "settings";

/**
 * Launch window.
 *
 * Modelled on Xcode's launch panel: one rounded rectangle split 60/40, with the
 * app identity and actions on the left and recent projects on the right.
 *
 * The three actions all end in the same place — a directory path that gets
 * opened as a project — so each one funnels into `openProject`.
 *
 * Recent Projects comes from `~/.claude.json` and only lists directories that
 * already have conversation history, so a freshly created or cloned directory
 * will not appear there until it has been used.
 */
export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>("none");
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(getProjectsUrl());
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.statusText}`);
      }
      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const openProject = (projectPath: string) => {
    const normalizedPath = projectPath.startsWith("/")
      ? projectPath
      : `/${projectPath}`;
    navigate(`/projects${normalizedPath}`);
  };

  const closeDialog = () => setActiveDialog("none");

  return (
    <div className="launch-viewport">
      <div className="launch-panel" data-testid="launch-panel">
        {/* Left: identity and actions */}
        <div className="launch-main">
          <VStack gap={3} hAlign="center">
            <div className="launch-logo">
              <AppIcon size={88} />
            </div>
            <VStack gap={1} hAlign="center">
              <Heading level={1}>PDLC Studio</Heading>
              <Text size="sm" color="secondary">
                {/* Injected from backend/package.json at build time. */}
                Version {__APP_VERSION__}
              </Text>
            </VStack>
          </VStack>

          <VStack gap={2} className="launch-actions" width="100%">
            <Button
              label="Create New Project..."
              variant="secondary"
              width="100%"
              icon={<Icon icon={FolderPlus} />}
              onClick={() => setActiveDialog("new")}
            />
            <Button
              label="Clone Git Repository..."
              variant="secondary"
              width="100%"
              icon={<Icon icon={GitBranch} />}
              onClick={() => setActiveDialog("clone")}
            />
            <Button
              label="Open Existing Project..."
              variant="secondary"
              width="100%"
              icon={<Icon icon={FolderOpen} />}
              onClick={() => setActiveDialog("open")}
            />
          </VStack>
        </div>

        {/* Right: recent projects */}
        <aside className="launch-aside">
          <HStack justify="between" vAlign="center" padding={4}>
            <Heading level={2}>Recent Projects</Heading>
            <SettingsButton onClick={() => setActiveDialog("settings")} />
          </HStack>

          <div className="launch-aside-scroll">
            {loading ? (
              <VStack gap={3} hAlign="center" justify="center" padding={6}>
                <Spinner size="md" label="Loading projects..." />
              </VStack>
            ) : error ? (
              <div style={{ padding: "var(--spacing-4)" }}>
                <Banner
                  status="error"
                  title="Error loading projects"
                  description={error}
                />
              </div>
            ) : projects.length === 0 ? (
              // Mirrors the reference screenshot's centred "No Recent Projects".
              <VStack gap={2} hAlign="center" justify="center" padding={6}>
                <Text color="secondary">No Recent Projects</Text>
                <Text size="sm" color="secondary">
                  Open a project to start a conversation.
                </Text>
              </VStack>
            ) : (
              <List>
                {projects.map((project) => (
                  <Item
                    as="li"
                    key={project.path}
                    data-testid="project-card"
                    onClick={() => openProject(project.path)}
                    startContent={
                      <Icon icon={FolderOpen} color="secondary" size="sm" />
                    }
                    label={
                      <Text type="code" size="sm">
                        {project.path}
                      </Text>
                    }
                  />
                ))}
              </List>
            )}
          </div>
        </aside>
      </div>

      <DirectoryPickerDialog
        isOpen={activeDialog === "open"}
        title="Open Existing Project"
        confirmLabel="Open"
        onCancel={closeDialog}
        onConfirm={(path) => {
          closeDialog();
          openProject(path);
        }}
      />

      <NewProjectDialog
        isOpen={activeDialog === "new"}
        onCancel={closeDialog}
        onCreated={(path) => {
          closeDialog();
          openProject(path);
        }}
      />

      <CloneRepositoryDialog
        isOpen={activeDialog === "clone"}
        onCancel={closeDialog}
        onCloned={(path) => {
          closeDialog();
          openProject(path);
        }}
      />

      <SettingsModal
        isOpen={activeDialog === "settings"}
        onClose={closeDialog}
      />
    </div>
  );
}

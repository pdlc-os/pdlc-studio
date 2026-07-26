import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { List } from "@astryxdesign/core/List";
import { Item } from "@astryxdesign/core/Item";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Folder } from "lucide-react";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  const handleProjectSelect = (projectPath: string) => {
    const normalizedPath = projectPath.startsWith("/")
      ? projectPath
      : `/${projectPath}`;
    navigate(`/projects${normalizedPath}`);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  return (
    <div className="app-shell">
      <HStack justify="between" vAlign="center">
        <Heading level={1}>Select a Project</Heading>
        <SettingsButton onClick={handleSettingsClick} />
      </HStack>

      <div className="app-scroll">
        {loading ? (
          <VStack gap={3} hAlign="center" justify="center" height="100%">
            <Spinner size="lg" label="Loading projects..." />
          </VStack>
        ) : error ? (
          <Banner
            status="error"
            title="Error loading projects"
            description={error}
          />
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Run Claude Code in a directory to make it available here."
            icon={<Icon icon={Folder} size="lg" />}
          />
        ) : (
          <VStack gap={3}>
            <Heading level={2}>Recent Projects</Heading>
            <List hasDividers>
              {projects.map((project) => (
                <Item
                  as="li"
                  key={project.path}
                  data-testid="project-card"
                  onClick={() => handleProjectSelect(project.path)}
                  startContent={<Icon icon={Folder} color="secondary" />}
                  label={
                    <Text type="code" size="sm">
                      {project.path}
                    </Text>
                  }
                  endContent={<Icon icon="chevronRight" color="secondary" />}
                />
              ))}
            </List>
          </VStack>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
    </div>
  );
}

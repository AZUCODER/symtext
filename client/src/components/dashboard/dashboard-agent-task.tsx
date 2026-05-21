"use client"

import { FormEvent, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { AgentTaskResponse } from "@/lib/api"
import { createDashboardAgentTask, getDashboardAgentTask } from "@/lib/agent-tasks-client"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type TaskAction = "generate" | "summarize" | "rewrite" | "categorize"

export function DashboardAgentTask() {
  const queryClient = useQueryClient()
  const [action, setAction] = useState<TaskAction>("generate")
  const [content, setContent] = useState("")
  const [taskId, setTaskId] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const trimmedTaskId = taskId.trim()

  const createTaskMutation = useMutation({
    mutationFn: () => createDashboardAgentTask({ action, content }),
    onSuccess: (response) => {
      setTaskId(response.task_id)
      setContent("")
      setValidationError(null)
      queryClient.setQueryData(queryKeys.agentTask(response.task_id), response)
    },
  })

  const taskStatusQuery = useQuery({
    queryKey: queryKeys.agentTask(trimmedTaskId),
    queryFn: () => getDashboardAgentTask(trimmedTaskId),
    enabled: false,
    staleTime: 15_000,
  })

  const canSubmit = useMemo(
    () => content.trim().length > 0 && !createTaskMutation.isPending,
    [content, createTaskMutation.isPending]
  )

  const currentTask = trimmedTaskId
    ? queryClient.getQueryData<AgentTaskResponse>(queryKeys.agentTask(trimmedTaskId)) ?? taskStatusQuery.data ?? null
    : null

  const status = currentTask?.status ?? null
  const result = currentTask?.result ?? null
  const error = validationError
    ?? currentTask?.error
    ?? (createTaskMutation.error instanceof Error ? createTaskMutation.error.message : null)
    ?? (taskStatusQuery.error instanceof Error ? taskStatusQuery.error.message : null)

  function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)
    createTaskMutation.mutate()
  }

  async function onCheckTask() {
    setValidationError(null)

    if (!trimmedTaskId) {
      setValidationError("Provide a task id to check status")
      return
    }

    const response = (await taskStatusQuery.refetch()).data as AgentTaskResponse | undefined
    if (response) {
      queryClient.setQueryData(queryKeys.agentTask(trimmedTaskId), response)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Task Runner</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onCreateTask} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="task-action">Action</FieldLabel>
              <Select value={action} onValueChange={(value) => setAction(value as TaskAction)}>
                <SelectTrigger
                  id="task-action"
                  className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10"
                >
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generate">Generate</SelectItem>
                  <SelectItem value="summarize">Summarize</SelectItem>
                  <SelectItem value="rewrite">Rewrite</SelectItem>
                  <SelectItem value="categorize">Categorize</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-content">Content</FieldLabel>
              <textarea
                id="task-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write content instruction for your agent task..."
                className="min-h-24 w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </Field>
            <Field>
              <Button type="submit" disabled={!canSubmit}>
                {createTaskMutation.isPending ? "Creating task..." : "Create Task"}
              </Button>
            </Field>
            <Field>
              <FieldLabel htmlFor="task-id">Task ID</FieldLabel>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  id="task-id"
                  value={taskId}
                  onChange={(event) => {
                    setTaskId(event.target.value)
                    if (validationError) {
                      setValidationError(null)
                    }
                  }}
                  placeholder="Paste task id"
                />
                <Button type="button" variant="outline" disabled={taskStatusQuery.isFetching} onClick={onCheckTask}>
                  {taskStatusQuery.isFetching ? "Checking..." : "Check Status"}
                </Button>
              </div>
            </Field>
            {status ? (
              <FieldDescription>
                Current status: <Badge variant={status === "completed" ? "default" : "secondary"}>{status}</Badge>
              </FieldDescription>
            ) : null}
            {result ? (
              <div className="space-y-2 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
                <p><span className="font-medium">Title:</span> {result.title}</p>
                <p><span className="font-medium">Category:</span> {result.category}</p>
                <p><span className="font-medium">Summary:</span> {result.summary}</p>
                {result.keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                ) : null}
                <details className="rounded-sm border border-border/60 p-2">
                  <summary className="cursor-pointer text-xs font-medium">Generated Markdown</summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs">{result.markdown}</pre>
                </details>
              </div>
            ) : null}
            {error ? <FieldDescription className="text-destructive">{error}</FieldDescription> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

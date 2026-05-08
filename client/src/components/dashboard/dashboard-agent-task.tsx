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
  const error = validationError
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
              <select
                id="task-action"
                value={action}
                onChange={(event) => setAction(event.target.value as TaskAction)}
                className="h-10 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="generate">Generate</option>
                <option value="summarize">Summarize</option>
                <option value="rewrite">Rewrite</option>
                <option value="categorize">Categorize</option>
              </select>
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
            {error ? <FieldDescription className="text-destructive">{error}</FieldDescription> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

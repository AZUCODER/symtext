"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { PartialBlock } from "@blocknote/core"
import { filterSuggestionItems } from "@blocknote/core/extensions"
import { en } from "@blocknote/core/locales"
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useExtension,
  useCreateBlockNote,
  useEditorChange,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import { DefaultChatTransport } from "ai"
import {
  AIMenu,
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getDefaultAIMenuItems,
  getAISlashMenuItems,
} from "@blocknote/xl-ai"
import { en as aiEn } from "@blocknote/xl-ai/locales"

import {
  getBlocknoteUploadErrorMessage,
  getBlocknoteUploadFolder,
  getBlocknoteUploadMediaType,
} from "@/lib/blocknote-upload"
import { uploadFileToOss } from "@/lib/media-client"

type EditorValue = {
  markdown: string
  json: string
  isEmpty: boolean
}

type Props = {
  initialMarkdown: string
  initialJson?: string | null
  onChange: (value: EditorValue) => void
}

const FormattingToolbarWithAI = () => (
  <FormattingToolbar>
    {getFormattingToolbarItems()}
    <AIToolbarButton />
  </FormattingToolbar>
)

function parseInitialBlocks(initialJson?: string | null): PartialBlock[] | undefined {
  if (!initialJson) {
    return undefined
  }

  try {
    const parsed = JSON.parse(initialJson) as unknown
    if (!Array.isArray(parsed)) {
      return undefined
    }

    return parsed as PartialBlock[]
  } catch {
    return undefined
  }
}

function hasBlockContent(markdown: string, jsonBlocks: PartialBlock[]): boolean {
  if (markdown.trim().length > 0) {
    return true
  }

  return jsonBlocks.some((block) => {
    if (block.type && block.type !== "paragraph") {
      return true
    }

    const content = block.content
    if (!Array.isArray(content)) {
      return false
    }

    return content.some((item) => {
      if (typeof item !== "object" || item === null) {
        return false
      }

      if (!("text" in item)) {
        return false
      }

      const text = item.text
      return typeof text === "string" && text.trim().length > 0
    })
  })
}

export function BlocknoteBlogEditor({ initialMarkdown, initialJson, onChange }: Props) {
  const initialBlocks = useMemo(() => parseInitialBlocks(initialJson), [initialJson])
  const didLoadMarkdownRef = useRef(false)
  const changeCounterRef = useRef(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeUploadCount, setActiveUploadCount] = useState(0)

  const editor = useCreateBlockNote({
    dictionary: {
      ...en,
      ai: aiEn,
    },
    extensions: [
      AIExtension({
        transport: new DefaultChatTransport({
          api: "/api/blocknote/ai",
        }),
      }),
    ],
    initialContent: initialBlocks,
    uploadFile: async (file) => {
      const mediaType = getBlocknoteUploadMediaType(file.type)
      const folder = getBlocknoteUploadFolder(mediaType)

      setUploadError(null)
      setActiveUploadCount((current) => current + 1)

      try {
        const uploaded = await uploadFileToOss({
          file,
          mediaType,
          folder,
        })
        return uploaded.publicUrl
      } catch (error) {
        const message = getBlocknoteUploadErrorMessage(error)
        setUploadError(message)
        throw error
      } finally {
        setActiveUploadCount((current) => Math.max(0, current - 1))
      }
    },
  })

  const aiExtension = useExtension(AIExtension, { editor })

  const aiMenuItems = useMemo(() => {
    return (
      menuEditor: Parameters<typeof getDefaultAIMenuItems>[0],
      aiResponseStatus: Parameters<typeof getDefaultAIMenuItems>[1],
    ) => {
      const items = getDefaultAIMenuItems(menuEditor, aiResponseStatus)

      if (aiResponseStatus === "thinking" || aiResponseStatus === "ai-writing") {
        return [
          ...items,
          {
            key: "cancel-running-ai",
            title: "Cancel current AI run",
            aliases: ["cancel", "stop", "abort"],
            onItemClick: () => {
              void aiExtension.abort("Canceled by user")
            },
            size: "small" as const,
          },
        ]
      }

      return items
    }
  }, [aiExtension])

  useEffect(() => {
    if (initialBlocks || didLoadMarkdownRef.current || !initialMarkdown.trim()) {
      return
    }

    didLoadMarkdownRef.current = true
    let cancelled = false

    const loadMarkdown = async () => {
      const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown)
      if (cancelled) {
        return
      }

      editor.replaceBlocks(editor.document, blocks)
    }

    void loadMarkdown()

    return () => {
      cancelled = true
    }
  }, [editor, initialBlocks, initialMarkdown])

  useEditorChange((nextEditor) => {
    const currentChange = ++changeCounterRef.current

    const syncValue = async () => {
      const blocks = nextEditor.document as PartialBlock[]
      const markdown = await nextEditor.blocksToMarkdownLossy(blocks)
      const json = JSON.stringify(blocks)

      if (currentChange !== changeCounterRef.current) {
        return
      }

      onChange({
        markdown,
        json,
        isEmpty: !hasBlockContent(markdown, blocks),
      })
    }

    void syncValue()
  }, editor)

  return (
    <div className="blog-body-editor overflow-hidden rounded-md border border-input bg-input/20 min-h-[640px]">
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        slashMenu={false}
        className="min-h-[640px] [&_.bn-editor]:min-h-[600px] [&_.bn-editor]:overflow-y-auto"
      >
        <AIMenuController aiMenu={(props) => <AIMenu {...props} items={aiMenuItems} />} />
        <FormattingToolbarController formattingToolbar={FormattingToolbarWithAI} />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [...getDefaultReactSlashMenuItems(editor), ...getAISlashMenuItems(editor)],
              query
            )
          }
        />
      </BlockNoteView>
      <div className="border-t border-input/70 px-3 py-2 text-xs text-muted-foreground">
        {activeUploadCount > 0 ? (
          <p>Uploading media to OSS...</p>
        ) : (
          <p>Tip: use /image, /video, or drag and drop files directly into the editor.</p>
        )}
        {uploadError && <p className="mt-1 text-destructive">{uploadError}</p>}
      </div>
    </div>
  )
}

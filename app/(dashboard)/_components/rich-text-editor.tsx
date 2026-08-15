"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

// Reused by Problem/Solution (ticket assignment flow) and Lesson Learned's
// Description. Two integration modes at once: the hidden input covers
// native `useActionState` form submission (`formData.get(name)`), while
// `onChange` covers callers that hand-build FormData themselves instead of
// submitting a real <form> (the ticket assignment modal/editor).
export function RichTextEditor({
  name,
  defaultValue,
  disabled,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: (html: string) => void;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: defaultValue ?? "",
    editable: !disabled,
    // Tiptap renders during SSR/hydration by default, which throws under
    // React 19 + App Router — must opt out.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (hiddenInputRef.current) hiddenInputRef.current.value = html;
      onChange?.(html);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const toolbarButtons = [
    {
      label: "Bold",
      icon: "bi-type-bold",
      isActive: () => editor?.isActive("bold") ?? false,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: "bi-type-italic",
      isActive: () => editor?.isActive("italic") ?? false,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Bulleted list",
      icon: "bi-list-ul",
      isActive: () => editor?.isActive("bulletList") ?? false,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: "bi-list-ol",
      isActive: () => editor?.isActive("orderedList") ?? false,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Link",
      icon: "bi-link-45deg",
      isActive: () => editor?.isActive("link") ?? false,
      run: () => {
        if (!editor) return;
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
          return;
        }
        const url = window.prompt("Link URL");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      },
    },
  ];

  return (
    <div className="border rounded">
      {!disabled && (
        <div className="btn-group btn-group-sm border-bottom p-1" role="toolbar" aria-label="Formatting">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              className={`btn btn-outline-secondary border-0 ${btn.isActive() ? "active" : ""}`}
              onClick={btn.run}
              aria-label={btn.label}
              title={btn.label}
            >
              <i className={`bi ${btn.icon}`} aria-hidden="true"></i>
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="p-2" style={{ minHeight: "8rem" }} />
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

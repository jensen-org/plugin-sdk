import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Jensen plugins",
  description:
    "Build extensions for Jensen: panes, commands, hotkeys, settings and access to files, the editor, the layout and the theme.",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/permissions" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "How a plugin runs", link: "/guide/lifecycle" },
          { text: "Panes", link: "/guide/panes" },
          { text: "Commands and hotkeys", link: "/guide/commands" },
          { text: "Settings", link: "/guide/settings" },
          { text: "The editor", link: "/guide/editor" },
          { text: "Files", link: "/guide/files" },
          { text: "The theme", link: "/guide/theme" },
          { text: "Menus and the status strip", link: "/guide/menus" },
          { text: "Testing", link: "/guide/testing" },
          { text: "Publishing", link: "/guide/publishing" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Permissions", link: "/reference/permissions" },
          { text: "Protocol", link: "/reference/protocol" },
          { text: "Errors", link: "/reference/errors" },
        ],
      },
    ],
  },
});

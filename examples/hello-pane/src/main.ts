import {
  CustomPaneView,
  Decorations,
  Notice,
  PaneView,
  Plugin,
  Setting,
  SettingTab,
} from "@jensen-org/plugin-sdk";
import * as ui from "@jensen-org/plugin-sdk/ui";

interface Data {
  greeting: string;
  clicks: number;
  highlightTodos: boolean;
}

const DEFAULTS: Data = { greeting: "Hello", clicks: 0, highlightTodos: true };

class Dashboard extends PaneView<{ filter: string }> {
  private get hello(): HelloPane {
    return this.plugin as HelloPane;
  }

  override render() {
    const { data } = this.hello;
    return [
      ui.Stack([
        ui.Heading(`${data.greeting}, Jensen`),
        ui.Text(`Clicked ${data.clicks} times`, "muted"),
        ui.Row([
          ui.Button({ label: "Click me", icon: "star", onClick: () => this.hello.bump() }),
          ui.Button({ label: "List docs", onClick: () => this.hello.listDocs() }),
        ]),
        ui.Input({
          label: "Filter",
          value: this.state.filter,
          onChange: async (value) => {
            await this.setState({ filter: value });
          },
        }),
        ui.Text(`Theme: ${this.app.theme.current.id} (${this.app.theme.appearance})`),
      ]),
    ];
  }
}

class Clock extends CustomPaneView {
  private timer?: ReturnType<typeof setInterval>;

  onMount(element: HTMLElement) {
    const face = document.createElement("p");
    face.style.cssText = "font:600 2rem/1 var(--font-mono);padding:1rem;color:var(--primary)";
    const tick = () => {
      face.textContent = new Date().toLocaleTimeString();
    };
    tick();
    this.timer = setInterval(tick, 1000);
    element.append(face);
  }

  override onUnmount() {
    clearInterval(this.timer);
  }
}

class HelloSettings extends SettingTab {
  constructor(private readonly hello: HelloPane) {
    super(hello.app, hello, { title: "Hello pane" });
  }

  display() {
    this.containerEl.addHeading("Greeting");
    new Setting(this.containerEl)
      .setName("Greeting")
      .setDesc("What the dashboard says before Jensen")
      .addText((text) =>
        text
          .setValue(this.hello.data.greeting)
          .onChange((value) => this.hello.update({ greeting: value })),
      );
    new Setting(this.containerEl)
      .setName("Highlight TODO comments")
      .addToggle((toggle) =>
        toggle
          .setValue(this.hello.data.highlightTodos)
          .onChange((value) => this.hello.update({ highlightTodos: value })),
      );
    new Setting(this.containerEl).setName("Reset the click counter").addButton((button) =>
      button
        .setButtonText("Reset")
        .setWarning()
        .onClick(() => this.hello.update({ clicks: 0 })),
    );
  }
}

export default class HelloPane extends Plugin {
  data: Data = { ...DEFAULTS };
  private status = this.addStatusBarItem("clicks");

  override async onload() {
    this.data = { ...DEFAULTS, ...((await this.loadData<Data>()) ?? {}) };

    this.registerPane("dashboard", Dashboard, { title: "Hello dashboard", icon: "rocket" });
    this.registerPane("clock", Clock, { title: "Hello clock", icon: "star", singleton: true });
    this.addSettingTab(new HelloSettings(this));

    this.addCommand({
      id: "open",
      name: "Open the dashboard",
      category: "Hello",
      hotkey: { key: "Mod+Shift+H" },
      callback: async () => {
        await this.app.workspace.openPane("dashboard", {
          state: { filter: "" },
          direction: "right",
        });
      },
    });
    this.addCommand({
      id: "date",
      name: "Insert today's date",
      category: "Hello",
      hotkey: { key: "Mod+Shift+D", when: "editorFocus" },
      callback: () =>
        this.app.editor.insert(new Date().toISOString().slice(0, 10)).then(() => undefined),
    });

    this.status.setIcon("rocket").onClick(() => this.bump());
    this.renderStatus();

    this.registerMenu("explorer", (menu, context) => {
      menu.addItem((item) =>
        item
          .setTitle(`Hello from ${context.path}`)
          .setIcon("star")
          .onClick(() => void new Notice(`${this.data.greeting} ${context.path}`)),
      );
    });

    this.registerEvent(this.app.editor.on("change", () => void this.highlightTodos()));
    this.registerEvent(this.app.theme.on("change", () => void this.refreshPanes()));
    await this.highlightTodos();
  }

  async bump(): Promise<void> {
    await this.update({ clicks: this.data.clicks + 1 });
  }

  async update(patch: Partial<Data>): Promise<void> {
    this.data = { ...this.data, ...patch };
    await this.saveData(this.data);
    this.renderStatus();
    await this.refreshPanes();
    await this.highlightTodos();
  }

  async listDocs(): Promise<void> {
    const entries = await this.app.files.list("docs");
    new Notice(entries.length ? entries.map((entry) => entry.name).join(", ") : "docs is empty");
  }

  private renderStatus(): void {
    this.status
      .setText(`${this.data.clicks} clicks`)
      .setTone(this.data.clicks > 0 ? "success" : "muted");
  }

  private async refreshPanes(): Promise<void> {
    for (const leaf of await this.app.workspace.getLeavesOfType("dashboard")) await leaf.refresh();
  }

  private async highlightTodos(): Promise<void> {
    const active = await this.app.editor.active();
    if (!active?.path) return;
    if (!this.data.highlightTodos) {
      await this.app.editor.clearDecorations("todos");
      return;
    }
    const text = await this.app.editor.getValue();
    const marks = [...text.matchAll(/TODO/g)].map((match) =>
      Decorations.mark(match.index, match.index + 4, {
        tone: "warning",
        tooltip: "Hello pane saw this",
      }),
    );
    await this.app.editor.decorate("todos", active.path, marks);
  }
}

import AppWindow from '@lucide/astro/icons/app-window';
import ArrowRightLeft from '@lucide/astro/icons/arrow-right-left';
import Box from '@lucide/astro/icons/box';
import Command from '@lucide/astro/icons/command';
import Container from '@lucide/astro/icons/container';
import Database from '@lucide/astro/icons/database';
import File from '@lucide/astro/icons/file';
import Hand from '@lucide/astro/icons/hand';
import HardDrive from '@lucide/astro/icons/hard-drive';
import KeyRound from '@lucide/astro/icons/key-round';
import Keyboard from '@lucide/astro/icons/keyboard';
import Mail from '@lucide/astro/icons/mail';
import MessageSquare from '@lucide/astro/icons/message-square';
import Plug from '@lucide/astro/icons/plug';
import Regex from '@lucide/astro/icons/regex';
import ScrollText from '@lucide/astro/icons/scroll-text';
import Sparkles from '@lucide/astro/icons/sparkles';
import SpellCheck from '@lucide/astro/icons/spell-check';
import Table from '@lucide/astro/icons/table';
import Terminal from '@lucide/astro/icons/terminal';
import Users from '@lucide/astro/icons/users';
import Video from '@lucide/astro/icons/video';
import Wrench from '@lucide/astro/icons/wrench';
import type { Lang } from '@/i18n/types';

/**
 * Open source projects shown on `/projects/` (`ProjectsPage.astro`), grouped
 * by category and rendered as a card grid like antfu.me/projects: a new
 * project is one entry in the right group, so the page scales without layout
 * changes. Within a group the array
 * order is the display order (curated, roughly most active first).
 * Deliberately minimal fields: a name, the repository URL and a one-line
 * description per language; no images, dates or tech tags.
 */
export interface Project {
  /** Repository name, the visible link text. */
  name: string;
  /** GitHub repository URL (the link target). */
  repo: string;
  /** One-line description in each language. */
  description: Record<Lang, string>;
  /** Lucide icon shown at the left of the card (decorative). */
  icon: typeof Box;
}

export interface ProjectGroup {
  /** Group heading in each language. */
  title: Record<Lang, string>;
  projects: readonly Project[];
}

export const PROJECT_GROUPS: readonly ProjectGroup[] = [
  {
    title: { en: 'AI Agents', zh: 'AI Agent' },
    projects: [
      {
        name: 'open-connector',
        icon: Plug,
        repo: 'https://github.com/oomol-lab/open-connector',
        description: {
          en: 'Open source auth gateway connecting 1000+ SaaS providers to AI agents',
          zh: '把 1000+ SaaS 服务接入 AI Agent 的开源鉴权网关',
        },
      },
      {
        name: 'aswap',
        icon: ArrowRightLeft,
        repo: 'https://github.com/BlackHole1/aswap',
        description: {
          en: 'Multi-account switcher for Claude Code and Claude Desktop, claude-swap plus maintained fixes',
          zh: 'Claude Code 与 Claude Desktop 多账号切换工具，基于 claude-swap 并持续维护修复补丁',
        },
      },
      {
        name: 'bh-skills',
        icon: Sparkles,
        repo: 'https://github.com/BlackHole1/bh-skills',
        description: {
          en: 'Personal agent skills for Claude Code, Codex, and other agents',
          zh: '给 Claude Code、Codex 等 Agent 用的个人技能集',
        },
      },
    ],
  },
  {
    title: { en: 'macOS', zh: 'macOS' },
    projects: [
      {
        name: 'LockIME',
        icon: Keyboard,
        repo: 'https://github.com/oomol-lab/LockIME',
        description: {
          en: 'Lock the macOS input source globally, per app, or per URL',
          zh: '锁定 macOS 输入法（全局 / 按应用 / 按 URL）',
        },
      },
      {
        name: 'CloseUp',
        icon: AppWindow,
        repo: 'https://github.com/oomol-lab/CloseUp',
        description: {
          en: 'Close, minimize, zoom, hide, or quit windows from Mission Control',
          zh: '在 macOS 调度中心里关闭、最小化、缩放、隐藏或退出窗口',
        },
      },
      {
        name: 'dockswipe',
        icon: Hand,
        repo: 'https://github.com/oomol-lab/dockswipe',
        description: {
          en: 'Trigger macOS trackpad swipe gestures from the CLI (Mission Control, Spaces, App Exposé)',
          zh: '用命令行触发 macOS 触控板滑动手势（调度中心、Spaces、App Exposé）',
        },
      },
      {
        name: 'passport-keys',
        icon: Command,
        repo: 'https://github.com/BlackHole1/passport-keys',
        description: {
          en: 'Turn the FoloToy AI Passport buttons into Mac keyboard shortcuts over USB or BLE',
          zh: '把 FoloToy AI Passport 的按键变成 Mac 快捷键，支持 USB 与蓝牙连接',
        },
      },
    ],
  },
  {
    title: { en: 'Containers & Virtualization', zh: '容器与虚拟化' },
    projects: [
      {
        name: 'ovm',
        icon: Box,
        repo: 'https://github.com/oomol-lab/ovm',
        description: {
          en: "Run the ovm-core VM on Apple's Virtualization Framework",
          zh: '在 Apple Virtualization Framework 上运行 ovm-core 虚拟机',
        },
      },
      {
        name: 'ovm-core',
        icon: HardDrive,
        repo: 'https://github.com/oomol-lab/ovm-core',
        description: {
          en: 'Minimal VM image for running Podman',
          zh: '运行 Podman 的最小虚拟机镜像',
        },
      },
      {
        name: 'ovm-ssh-agent',
        icon: KeyRound,
        repo: 'https://github.com/oomol-lab/ovm-ssh-agent',
        description: {
          en: 'SSH agent compatible with any third-party SSH agent',
          zh: '兼容任意第三方 SSH Agent 的 SSH Agent',
        },
      },
      {
        name: 'vsock-guest-exec',
        icon: Terminal,
        repo: 'https://github.com/oomol-lab/vsock-guest-exec',
        description: {
          en: 'Dynamically execute commands over vsock',
          zh: '通过 vsock 动态执行命令',
        },
      },
      {
        name: 'sparse-file-js',
        icon: File,
        repo: 'https://github.com/oomol-lab/sparse-file-js',
        description: {
          en: 'Create and resize sparse files with Node.js',
          zh: '使用 Node.js 创建 / 调整稀疏文件大小',
        },
      },
      {
        name: 'podman',
        icon: Container,
        repo: 'https://github.com/podman-container-tools/podman',
        description: {
          en: 'A tool for managing OCI containers and pods (contributor)',
          zh: '管理 OCI 容器与 Pod 的工具（贡献者）',
        },
      },
    ],
  },
  {
    title: { en: 'Developer Tools', zh: '开发者工具' },
    projects: [
      {
        name: 'sesmate',
        icon: Mail,
        repo: 'https://github.com/BlackHole1/sesmate',
        description: {
          en: 'Mock AWS SES for offline or no-credentials use',
          zh: '模拟 AWS SES（用于离线或没有权限时）',
        },
      },
      {
        name: 'idea-spell-check',
        icon: SpellCheck,
        repo: 'https://github.com/BlackHole1/idea-spell-check',
        description: {
          en: 'Spell-check plugin for IntelliJ IDEA',
          zh: 'IntelliJ IDEA 的拼写检查插件',
        },
      },
      {
        name: 'electron-devtools-vendor',
        icon: Wrench,
        repo: 'https://github.com/BlackHole1/electron-devtools-vendor',
        description: {
          en: 'Vendored Electron DevTools extensions',
          zh: 'Electron DevTools 扩展的本地副本',
        },
      },
      {
        name: 'github-mutual-following-checker',
        icon: Users,
        repo: 'https://github.com/BlackHole1/github-mutual-following-checker',
        description: {
          en: 'Check mutual-follow relationships between GitHub users',
          zh: '检查 GitHub 用户之间的互相关注关系',
        },
      },
      {
        name: 'rebirth',
        icon: Video,
        repo: 'https://github.com/alo7/rebirth',
        description: {
          en: 'Record a web page on the server',
          zh: '在服务端录制 Web 页面',
        },
      },
    ],
  },
  {
    title: { en: 'Libraries & SDKs', zh: '库与 SDK' },
    projects: [
      {
        name: 'regexp-go-to-js',
        icon: Regex,
        repo: 'https://github.com/BlackHole1/regexp-go-to-js',
        description: {
          en: 'Convert Go regular expressions to JavaScript',
          zh: '将 Go 的正则表达式转换为 JavaScript 的正则表达式',
        },
      },
      {
        name: 'wxwork_message_sdk',
        icon: MessageSquare,
        repo: 'https://github.com/BlackHole1/wxwork_message_sdk',
        description: {
          en: 'SDK for receiving and replying to WeCom messages',
          zh: '企业微信接收 / 回复消息 SDK',
        },
      },
      {
        name: 'fastify-typeorm-query-runner',
        icon: Database,
        repo: 'https://github.com/web-server-userland/fastify-typeorm-query-runner',
        description: {
          en: 'Fastify plugin for TypeORM QueryRunner',
          zh: 'Fastify TypeORM QueryRunner 插件',
        },
      },
      {
        name: 'alicloud-sls-log',
        icon: ScrollText,
        repo: 'https://github.com/BlackHole1/alicloud-sls-log',
        description: {
          en: 'Alibaba Cloud SLS (Log Service) SDK in TypeScript',
          zh: '阿里云日志服务（SLS）TypeScript SDK',
        },
      },
      {
        name: 'alicloud-tablestore',
        icon: Table,
        repo: 'https://github.com/oomol-lab/alicloud-tablestore',
        description: {
          en: 'Alibaba Cloud Tablestore SDK for Node.js',
          zh: '阿里云表格存储（Tablestore）Node.js SDK',
        },
      },
    ],
  },
];

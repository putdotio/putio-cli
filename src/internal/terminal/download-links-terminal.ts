import { translate } from "@putdotio/translations";

export const renderDownloadLinksTerminal = (value: {
  readonly links_status: string;
  readonly error_msg?: string | null;
  readonly links: null | {
    readonly download_links: ReadonlyArray<string>;
    readonly media_links: ReadonlyArray<string>;
    readonly mp4_links: ReadonlyArray<string>;
  };
}) => {
  if (value.links === null) {
    return [
      translate("cli.downloadLinks.terminal.status", { value: value.links_status }),
      translate("cli.downloadLinks.terminal.error", {
        value: value.error_msg ?? translate("cli.common.none"),
      }),
    ].join("\n");
  }

  const linkGroups = [
    [translate("cli.downloadLinks.terminal.downloadLinks"), value.links.download_links] as const,
    [translate("cli.downloadLinks.terminal.mediaLinks"), value.links.media_links] as const,
    [translate("cli.downloadLinks.terminal.mp4Links"), value.links.mp4_links] as const,
  ].filter(([, links]) => links.length > 0);

  const summary = translate("cli.downloadLinks.terminal.readySummary", {
    downloadCount: value.links.download_links.length,
    mediaCount: value.links.media_links.length,
    mp4Count: value.links.mp4_links.length,
  });
  const sections = linkGroups.map(([title, links]) =>
    [
      translate("cli.downloadLinks.terminal.linksSection", { title, count: links.length }),
      ...links,
    ].join("\n"),
  );

  return [
    translate("cli.downloadLinks.terminal.status", { value: value.links_status }),
    summary,
    ...sections,
  ].join("\n\n");
};

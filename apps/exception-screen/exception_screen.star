load("render.star", "render")

FONT = "CG-pixel-3x5-mono"
FONT_BIG = "6x13"
BG = "#080b11"
GREEN = "#71e69a"
AMBER = "#ffb454"
RED = "#ff5f71"

def _int(config, name, fallback):
    value = config.str(name)
    return int(value) if value else fallback

def _color(severity):
    return RED if severity == "critical" else AMBER

def _all_clear():
    return render.Root(
        max_age = 900,
        child = render.Box(
            color = BG,
            child = render.Column(
                main_align = "center",
                cross_align = "center",
                children = [
                    render.Box(
                        height = 18,
                        child = render.Row(
                            main_align = "center",
                            cross_align = "center",
                            children = [
                                render.Box(width = 4, height = 4, color = GREEN),
                                render.Box(width = 2),
                                render.Text("ALL CLEAR", font = "tb-8", color = GREEN),
                            ],
                        ),
                    ),
                    render.Box(
                        height = 14,
                        child = render.Column(
                            main_align = "center",
                            cross_align = "center",
                            children = [render.Text("SYSTEMS OK", font = FONT, color = "#8390a0")],
                        ),
                    ),
                ],
            ),
        ),
    )

def _alert_frame(label, value, severity, position, count):
    color = _color(severity)
    return render.Box(
        color = BG,
        child = render.Row(children = [
            render.Box(width = 4, color = color),
            render.Box(
                width = 60,
                child = render.Column(
                    children = [
                        render.Box(
                            height = 9,
                            child = render.Row(
                                cross_align = "center",
                                children = [
                                    render.Box(width = 4),
                                    render.Box(
                                        width = 34,
                                        child = render.Text(label[:10], font = FONT, color = "#f7f8fa"),
                                    ),
                                    render.Box(
                                        width = 18,
                                        child = render.Column(
                                            cross_align = "end",
                                            children = [render.Text("%d/%d" % (position, count), font = FONT, color = "#687687")],
                                        ),
                                    ),
                                    render.Box(width = 4),
                                ],
                            ),
                        ),
                        render.Box(
                            height = 23,
                            child = render.Column(
                                main_align = "center",
                                cross_align = "center",
                                children = [render.Text(value[:8], font = FONT_BIG, color = color)],
                            ),
                        ),
                    ],
                ),
            ),
        ]),
    )

def _alerts(config, count):
    frames = [_alert_frame(
        config.str("label_1") or "LOW DISK",
        config.str("value_1") or "19G FREE",
        config.str("severity_1") or "critical",
        1,
        count,
    )]
    if count == 1:
        return render.Root(max_age = 900, child = frames[0])
    frames.append(_alert_frame(
        config.str("label_2") or "CLOUD",
        config.str("value_2") or "HIGH",
        config.str("severity_2") or "warn",
        2,
        count,
    ))
    if count > 2:
        frames.append(_alert_frame(
            config.str("label_3") or "DISK",
            config.str("value_3") or "LOW",
            config.str("severity_3") or "warn",
            3,
            count,
        ))
    if count > 3:
        frames.append(_alert_frame(
            config.str("label_4") or "TIMECARD",
            config.str("value_4") or "NO DATA",
            config.str("severity_4") or "warn",
            4,
            count,
        ))
    return render.Root(
        delay = 2400,
        max_age = 900,
        child = render.Animation(children = frames),
    )

def main(config):
    count = _int(config, "count", 0)
    if count == 0:
        return _all_clear()
    return _alerts(config, count)

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

def _single(config):
    severity = config.str("severity_1") or "critical"
    color = _color(severity)
    label = config.str("label_1") or "LOW DISK"
    value = config.str("value_1") or "19G FREE"
    return render.Root(
        max_age = 900,
        child = render.Box(
            color = BG,
            child = render.Row(children = [
                render.Box(
                    width = 15,
                    color = "#6b2530" if severity == "critical" else "#6a4b20",
                    child = render.Column(
                        main_align = "center",
                        cross_align = "center",
                        children = [render.Text("!", font = "tom-thumb", color = "#ffffff")],
                    ),
                ),
                render.Box(
                    width = 49,
                    child = render.Column(
                        main_align = "center",
                        cross_align = "center",
                        children = [
                            render.Text(label, font = FONT, color = color),
                            render.Text(value, font = FONT_BIG, color = "#ffffff"),
                            render.Text("CHECK NOW", font = FONT, color = "#8390a0"),
                        ],
                    ),
                ),
            ]),
        ),
    )

def _alert_lane(label, value, severity):
    color = _color(severity)
    return render.Box(
        width = 62,
        height = 14,
        color = "#151b25",
        child = render.Row(
            cross_align = "center",
            children = [
                render.Box(
                    width = 33,
                    child = render.Row(children = [
                        render.Box(width = 3, height = 8, color = color),
                        render.Text(" " + label[:7], font = FONT, color = "#f7f8fa"),
                    ]),
                ),
                render.Box(
                    width = 27,
                    child = render.Column(
                        cross_align = "end",
                        children = [render.Text(value[:7], font = FONT, color = color)],
                    ),
                ),
            ],
        ),
    )

def _stack(config, count):
    return render.Root(
        max_age = 900,
        child = render.Box(
            color = BG,
            child = render.Column(
                main_align = "center",
                cross_align = "center",
                children = [
                    render.Text("%d ALERTS" % count, font = FONT, color = RED),
                    _alert_lane(
                        config.str("label_1") or "CI",
                        config.str("value_1") or "FAILED",
                        config.str("severity_1") or "critical",
                    ),
                    _alert_lane(
                        config.str("label_2") or "CLOUD",
                        config.str("value_2") or "HIGH",
                        config.str("severity_2") or "warn",
                    ),
                ],
            ),
        ),
    )

def main(config):
    count = _int(config, "count", 0)
    if count == 0:
        return _all_clear()
    if count == 1:
        return _single(config)
    return _stack(config, count)

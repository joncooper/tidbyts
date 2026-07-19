load("render.star", "render")

FONT = "CG-pixel-3x5-mono"
FONT_BIG = "6x13"
BG = "#080b11"
CYAN = "#56e0d2"
GREEN = "#71e69a"

def _int(config, name, fallback):
    value = config.str(name)
    return int(value) if value else fallback

def _decimal(tenths):
    return "%d.%d" % (int(tenths / 10), tenths % 10)

def _timer(seconds):
    hours = int(seconds / 3600)
    minutes = int(seconds / 60) % 60
    minute_text = "0%d" % minutes if minutes < 10 else str(minutes)
    if hours > 0:
        return "%d:%s" % (hours, minute_text)
    second_value = seconds % 60
    second_text = "0%d" % second_value if second_value < 10 else str(second_value)
    return "%s:%s" % (minute_text, second_text)

def _delta(week, target):
    difference = target - week
    if difference > 0:
        return "%sH LEFT" % _decimal(difference)
    if difference < 0:
        return "+%sH" % _decimal(-difference)
    return "GOAL HIT"

def _paused(week, target, celebrating):
    heading = "GOAL HIT!" if celebrating else "BILLABLE WEEK"
    heading_color = GREEN if celebrating else CYAN
    footer = "NICE WORK" if celebrating else _delta(week, target)
    return render.Box(
        color = BG,
        child = render.Column(
            children = [
                render.Box(
                    height = 8,
                    child = render.Column(
                        main_align = "center",
                        cross_align = "center",
                        children = [render.Text(heading, font = FONT, color = heading_color)],
                    ),
                ),
                render.Box(
                    height = 17,
                    child = render.Row(
                        main_align = "center",
                        cross_align = "center",
                        children = [render.Text(_decimal(week), font = FONT_BIG, color = "#ffffff")],
                    ),
                ),
                render.Box(
                    height = 7,
                    child = render.Column(
                        main_align = "center",
                        cross_align = "center",
                        children = [render.Text(footer, font = FONT, color = heading_color if celebrating else "#a8b4c4")],
                    ),
                ),
            ],
        ),
    )

def main(config):
    week = _int(config, "week_tenths", 142)
    target = _int(config, "target_tenths", 200)
    active = _int(config, "active", 0) == 1
    celebrate = _int(config, "celebrate", 0) == 1
    session = _int(config, "session_seconds", 0)
    if active:
        return render.Root(
            max_age = 900,
            child = render.Box(
                color = BG,
                child = render.Column(
                    children = [
                        render.Box(
                            height = 8,
                            child = render.Row(
                                main_align = "center",
                                cross_align = "center",
                                children = [
                                    render.Box(width = 3, height = 3, color = GREEN),
                                    render.Text(" ACTIVE", font = FONT, color = GREEN),
                                ],
                            ),
                        ),
                        render.Box(
                            height = 17,
                            child = render.Column(
                                main_align = "center",
                                cross_align = "center",
                                children = [render.Text(_timer(session), font = FONT_BIG, color = "#ffffff")],
                            ),
                        ),
                        render.Box(
                            height = 7,
                            child = render.Column(
                                main_align = "center",
                                cross_align = "center",
                                children = [render.Text("%sH THIS WK" % _decimal(week), font = FONT, color = "#a8b4c4")],
                            ),
                        ),
                    ],
                ),
            ),
        )

    if celebrate:
        return render.Root(
            delay = 750,
            max_age = 900,
            child = render.Animation(children = [
                _paused(week, target, True),
                _paused(week, target, False),
            ]),
        )
    return render.Root(max_age = 900, child = _paused(week, target, False))

load("render.star", "render")

FONT = "CG-pixel-3x5-mono"
FONT_BIG = "6x13"
BG = "#080b11"
CYAN = "#56e0d2"
VIOLET = "#b38cff"
GREEN = "#71e69a"
AMBER = "#ffb454"
RED = "#ff5f71"

def _int(config, name, fallback):
    value = config.str(name)
    return int(value) if value else fallback

def _metric(value, label, color):
    display = str(value) if value < 100 else "99"
    return render.Box(
        width = 20,
        height = 23,
        color = "#151b25",
        child = render.Column(
            main_align = "center",
            cross_align = "center",
            children = [
                render.Text(display, font = FONT_BIG, color = color),
                render.Text(label, font = FONT, color = "#c8d2df"),
            ],
        ),
    )

def _attention(count):
    return render.Root(
        max_age = 900,
        child = render.Box(
            color = BG,
            child = render.Row(
                children = [
                    render.Box(
                        width = 18,
                        color = "#6b2530",
                        child = render.Column(
                            main_align = "center",
                            cross_align = "center",
                            children = [render.Text("!", font = "tom-thumb", color = "#ffffff")],
                        ),
                    ),
                    render.Box(
                        width = 46,
                        child = render.Column(
                            main_align = "center",
                            cross_align = "center",
                            children = [
                                render.Text("NEEDS YOU", font = FONT, color = AMBER),
                                render.Text(str(count), font = FONT_BIG, color = "#ffffff"),
                                render.Text("CODEX TASKS", font = FONT, color = "#8290a3"),
                            ],
                        ),
                    ),
                ],
            ),
        ),
    )

def main(config):
    live = _int(config, "live", 4)
    warm = _int(config, "warm", 9)
    jobs = _int(config, "jobs", 2)
    needs = _int(config, "needs", 0)
    if needs > 0:
        return _attention(needs)

    return render.Root(
        max_age = 900,
        child = render.Box(
            color = BG,
            child = render.Column(
                children = [
                    render.Box(
                        height = 9,
                        child = render.Row(
                            main_align = "center",
                            cross_align = "center",
                            children = [
                                render.Box(width = 3, height = 3, color = CYAN),
                                render.Text(" CODEX CTRL", font = FONT, color = "#f7f8fa"),
                            ],
                        ),
                    ),
                    render.Row(
                        expanded = True,
                        main_align = "space_between",
                        children = [
                            _metric(live, "NOW", CYAN),
                            _metric(warm, "WARM", VIOLET),
                            _metric(jobs, "JOBS", GREEN),
                        ],
                    ),
                ],
            ),
        ),
    )

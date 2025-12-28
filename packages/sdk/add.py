def add(a, b):
    """
    Add two numbers together.

    Args:
        a: The first number (int or float)
        b: The second number (int or float)

    Returns:
        The sum of a and b

    Raises:
        TypeError: If either argument is not a number
    """
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Both arguments must be numbers")

    return a + b

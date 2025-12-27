def add(a, b):
    """
    Add two numbers together.

    Args:
        a: First number (int or float)
        b: Second number (int or float)

    Returns:
        The sum of a and b

    Raises:
        TypeError: If either argument is not a number
    """
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Both arguments must be numbers")

    return a + b


if __name__ == "__main__":
    # Example usage
    print(f"add(5, 3) = {add(5, 3)}")
    print(f"add(2.5, 1.5) = {add(2.5, 1.5)}")
    print(f"add(-10, 20) = {add(-10, 20)}")

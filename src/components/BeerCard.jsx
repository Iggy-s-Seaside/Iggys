function BeerCard({ item: { name, type, price, description } }) {
    return (
        <div>
            <h3>
                {name.toUpperCase()} {price}
            </h3>
            <p>{description}</p>
        </div>
    );
}

export default BeerCard;
